import React from 'react';
import axios from 'axios';
// eslint-disable-next-line
import { Navbar, NavbarBrand, NavbarNav, NavLinkItem, Container, Input } from '../components/Bootstrap';
import Template from './Template';
import './page.css'
import Button from '../components/Bootstrap/Button';
import * as api from '../api';
import { Table } from '../components/Table';
import RequestAch from './modals/RequestAch';
import Pane from '../components/Pane';
import Spinner from './modals/Spinner';
import AchConsent from './modals/AchConsent';

declare var StripeCheckout;
declare var Stripe;
var stripe = null; //= Stripe('pk_test_edJT25Bz1YVCJKIMvmBGCS5Y');

class Tenant extends Template {
    constructor(props) {
        super(props)

        this.payRentWithCreditCard = this.payRentWithCreditCard.bind(this);
        this.submitMaintenanceRequest = this.submitMaintenanceRequest.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.paymentTransform = this.paymentTransform.bind(this);
        this.maintRequestTransform = this.maintRequestTransform.bind(this);
        this.paymentCheckChanged = this.paymentCheckChanged.bind(this);
        this.requestRentData = this.requestRentData.bind(this);

        this.rentColumns = [
            { name: 'unitName', label: 'Unit' },
            { name: 'amount', label: 'Amount' },
            { name: 'due', label: 'Due' },
            { name: 'payButton', label: 'Pay' },
        ]
        this.maintRequestColumns = [
            { name: 'message', label: 'Message' },
            { name: 'status', label: 'Status' },
            { name: 'createdAt', label: 'Date Submited'}
        ]

        this.state = {
            ownedMaintRequest: '',
            paymentTable: {
                columns: this.rentColumns,
                items: null,
            },
            checkedPaymentIds: [], // : number[]
            totalDue: 0,
            message: '',
            maintTable: {
                columns: this.maintRequestColumns,
                items: null
            },
            processingPayment: false,
        };

    }

    componentDidMount() {
        this.requestRentData();
        this.requestMaintData();
    }

    requestMaintData() {
        this.setState({
            maintTable: {
                columns: this.maintRequestColumns,
                items: null
            }
        });

        api.getOwnMaintRequest().then(maintRequests => {
            this.setState({
                maintTable: {
                    columns: this.maintRequestColumns,
                    items: maintRequests
                }
            });
        });
    }

    requestRentData() {
        this.setState({
            paymentTable: {
                columns: this.rentColumns,
                items: null,
            },
            totalDue: 0,
            checkedPaymentIds: [],
            processingPayment: false,
        });
    
        api
            .getRentDue()
            .then(invoices => {
                var totalDue = invoices.reduce((acc, item) => acc + item.amount, 0);
                var checkedPayments = invoices.map(invoice => invoice.id);

                this.setState({
                    paymentTable: {
                        columns: this.rentColumns,
                        items: invoices,
                    },
                    totalDue: totalDue,
                    checkedPaymentIds: checkedPayments,
                    processingPayment: false,
                });
            });
        // api.getOwnMaintRequest().then(maintRequests => {
        //     this.setState({
        //         maintTable: {
        //             columns: this.maintRequestColumns,
        //             items: maintRequests
        //         }
        //     });
        // });
    }

    payRentWithCreditCard = (ev) => {
        var checkoutHandler = StripeCheckout.configure({
            key: this.props.user.stripeApiKey,
            locale: "auto"
        });

        checkoutHandler.open({
            name: "132 Chapel St. LLC",
            description: "Rent Payment",
            token: this.handleTokenCard,
            email: this.props.user.email || '',
        });
    }

    requestACH = (data) => {
        if (!stripe) stripe = new Stripe(this.props.user.stripeApiKey);
        stripe.createToken('bank_account', {
              country: 'US',
              currency: 'usd',
              account_holder_name: data.name,
              account_holder_type: data.accountType,
              routing_number: data.accountRouting,
              account_number: data.accountNumber
        }).then(token => {
            console.log(token);
            axios.post('/api/setupACH', token)
            .then(response => {
                console.log('Token Sent');
                this.showModal(<p>Your account details have been submitted. An email will be sent with instructions to verify the account.</p>, "Account Submitted");
                this.refreshUser();
            }).catch(error => {
                console.log(error);
                this.showModal(<p>There was an error submitting your account information.</p>, "Error");
            });
        })
        

        // api.setupACH(data)
        //     .then(response => {
        //         if (response.result == 'success') {
        //             this.showModal(<p>Your account details have been submitted. An email will be sent with instructions to verify the account.</p>, "Account Submitted");
        //         } else {
        //             console.log(response.result.error || 'setupACH returned an unexpected value');
        //             this.showModal(<p>There was an error submitting your account information.</p>, "Error");
        //         }
        //     });
    }

    promptForACH = (ev) => {
        // If user is already verified for ACH, show the consent form
        if (this.props.user && this.props.user.stripeACHVerified) {
            this.showModal(
                <AchConsent onAgree={this.payRentWithACH} amount={this.state.totalDue} company={this.props.bannerText} />,
                "Authorize Payment", true);
        } else {
            // Unverified users will get the default info or setup modals
            this.payRentWithACH();
        }
    }

    payRentWithACH = (ev) => {
        this.setState({ processingPayment: true });
        
        api.payACH(this.state.checkedPaymentIds)
            .then(response => {
                if (response.result == 'paid') {
                    this.showModal(<p>Your payment has been submitted via ACH.</p>, 'Payment Submitted');
                    this.requestRentData();
                } else if (response.result == 'needs verification') {
                    this.showModal(<p>Your account has not been verified. Please see the email that was sent when you requested ACH service.</p>, 'ACH Not Verified');
                } else if (response.result == 'needs setup') {
                    this.showModal(<RequestAch onRequestAch={this.requestACH} />, 'Request ACH Service');
                } else {
                    this.showModal(<p>There was an error submitting the request. Please contact your property manager for more information.</p>, 'Error');
                }
            }).catch(err => {
                console.error(err);
            }).then(nothing => {
                this.setState({ processingPayment: false });
            });
    }
    

    handleTokenCard = (token) => {
        token.invoiceList = this.state.checkedPaymentIds;

        this.setState({ processingPayment: true });

        axios.post("/api/submitPayment", token)
            .then(response => {
                var output = response.data;
                
                console.log(output);

                this.requestRentData(); // Refresh rent due table
                if (output.status === "succeeded") {
                    console.log("successful payment");
                    this.showModal(<p>Your payments has been submitted.</p>, "Payment");
                } else {
                    throw Error('')
                }
            }).catch(error => {
                console.log(error);

                this.requestRentData();
                this.showModal(<p>There was an error with your payment.</p>, "Error");
        });
    }

    paymentCheckChanged(event) {
        var checked = event.target.checked || false;
        var id = parseInt(event.target.name);

        var checkedIds = this.state.checkedPaymentIds.slice();

        if (checked) { // Ensure it's in the list
            if (!this.state.checkedPaymentIds.includes(id)) {
                checkedIds.push(id);
            }
        } else { // Ensure it's NOT in the list
            var indexOf = checkedIds.indexOf(id);
            if (indexOf >= 0) checkedIds.splice(indexOf, 1);
        }

        var selectedPayments =
            this.state.paymentTable.items.filter(item => checkedIds.includes(item.id));

        this.setState({
            checkedPaymentIds: checkedIds,
            totalDue: selectedPayments.reduce((total, item) => total + item.amount, 0)
        });
    }

    getSelectedPayments() {
        var allShownPayments = this.state.paymentTable.items.slice();
        var allCheckedPayments = allShownPayments.filter(payment => this.state.checkedPaymentIds.includes(payment.id));

        return allCheckedPayments;
    }

    /**
     * Converts values from this.state.paymentTable to JSX
     * @param {*} col - column name
     * @param {*} value - column value
     * @param {*} item - item being displayed
     */
    maintRequestTransform (col,value,item) {
        if (col === 'message') {
            return value
        } else if (col === 'status') {
            if (value) {
                return value = "Open"
            } else {
                return value = "Completed"
            }            
        } else if (col === 'createdAt') {
            return new Date(value).toLocaleDateString();
        } 
    }
     paymentTransform(col, value, item) {
        if (col === 'payButton') {
            return <input
                type='checkbox'
                checked={this.state.checkedPaymentIds.includes(item.id)}
                onChange={this.paymentCheckChanged}
                disabled={this.state.processingPayment}
                name={item.id}
            />;
        } else if (col === 'amount') {
            return this.formatDollars(value);
        } else if (col === 'due') {
            return new Date(value).toLocaleDateString();
        } else {
            return value;
        }
    }

    /** Formats a number as a dollar amount */
    formatDollars(value) {
        return '$' + parseFloat(value).toFixed(2);
    }

    getNavItems() {
        if (!this.props.user) {
            return [{ path: '/tenant', text: 'Home', altPaths: ['/'] }];
        }
        return this.tenantNavLinks;
    }


    handleChange(event) {
        this.setState({ message: event.target.value });
    }

    submitMaintenanceRequest(event) {
        // alert('A name was submitted: ' + this.state.value);
        event.preventDefault();

        axios.post('/api/postMaintRequest', {
            message: this.state.message
        }).then((resMaint) => {
            console.log("Post Maintenance Request works!");
            this.requestMaintData();        
        });
        this.setState({ message: '' });                          
    }


    getContent() {
        if (!this.props.user) {
            return <p>Log in to view content</p>
        }
        return (
            <Container>
                <Pane>
                    <h3>Rent Due</h3>

                    {this.getRentTable()}
                    <hr />
                    <p>
                        Total:  <span className='rent-amount'>{this.formatDollars(this.state.totalDue || 0)}</span>
                    </p><p>
                        <Button
                            disabled={this.state.processingPayment || (this.state.totalDue === 0)}
                            onClick={this.payRentWithCreditCard}
                            className='mt-3'
                        >
                            Pay by card
                        </Button>
                        &emsp;
                        <Button
                            disabled={this.state.processingPayment || (this.state.totalDue === 0)}
                            onClick={this.promptForACH}
                        >
                            Pay by ACH
                        </Button>
                    </p>
                </Pane>
                <Pane>
                    <h3>Maintenance Requests</h3>
                    <form>
                        <label>
                            Please describe the issue that needs to be resolved:
                            <br></br>
                            <Input type="text" value={this.state.message} onChange={this.handleChange} className='mt-3' />
                        </label>
                        <br></br>
                        <Button onClick={this.submitMaintenanceRequest} disabled={this.state.message.trim().length == 0}>Request Maintenance</Button>
                    </form>
                    <hr></hr>
                    {this.getMaintTable()}
                </Pane>    
            </Container>
        );
    }

    getRentTable() {
        if (this.state.paymentTable.items === null) return <Spinner />;
        if (this.state.paymentTable.items.length === 0) return <p>You have no payments due.</p>;
        
        return (
            <Table
                data={this.state.paymentTable}
                transform={this.paymentTransform}
            />
        );
    }

    getMaintTable() {
        if (this.state.maintTable.items === null) return <Spinner />;
        if (this.state.maintTable.items.length === 0) return <p>You have no open maintenance items.</p>;
        return (
            <Table
                data={this.state.maintTable}
                transform={this.maintRequestTransform}
            />
        );
    }
}

export default Tenant;
