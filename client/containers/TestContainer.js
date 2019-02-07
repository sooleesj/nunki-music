import React, { Component } from 'react';
import { fetchObjects } from "../actions";

class TestContainer extends Component {
    constructor(props) {
        super(props);
        this.state = {

        }
    }

    componentDidMount() {
        fetchObjects().then(data => {
            this.setState({ tenants: data.data })
        });
    }

    render() {
        console.log("this.state :", this.state);
        if (!this.state.tenants) {
            console.log("loading...")
            return (<div>Loading...</div>);
        }
        return (
            <div>
                TEST
      </div>
        );
    }
}


export default TestContainer;