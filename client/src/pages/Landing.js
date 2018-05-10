import React from 'react';
import { Navbar, NavbarBrand, NavbarNav, NavLinkItem, Container } from '../components/Bootstrap';
import Template from './Template';
import { Link } from 'react-router-dom';
import './page.css'

class Landing extends React.Component {
    constructor(props) {
        super(props)
        this.state = {

        };
    }

    render() {
        return (
            <Template
                navItems={[
                    { path: '/', text: 'Information' },
                    { path: '/', text: 'Request an Account'},
                ]}
                content={
                    <div>
                        <ul>
                            <li><Link to='/'>Landing page</Link></li>
                            <li><Link to='/admin/overview'>Admin Overview</Link></li>
                            <li><Link to='/admin/units'>Admin Unit Details</Link></li>
                            <li><Link to='/admin/maint'>Admin Maintenance</Link></li>
                            <li><Link to='/admin/payments'>Admin Payments</Link></li>
                            <li><Link to='/admin/users'>Admin Users</Link></li>
                            <li><Link to='/tenant'>Tenant</Link></li>
                        </ul>    
                    </div>
                }
            />
        )

    }
}

export default Landing;