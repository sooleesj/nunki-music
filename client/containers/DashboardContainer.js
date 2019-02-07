import React, { Component } from "react";
import Breadcrumb from "../components/Breadcrumb";
import { Link } from "react-router";

class DashboardContainer extends Component {
  render() {
    // console.log("this.state: ", this.state);
    // if (!this.state) {
    //     console.log("loading...")
    //     return (<div>Loading...</div>);
    // }

    return (
      <div>
        <Breadcrumb>
          <Link to="/">Home</Link>
          <h5>((username)) is logged in</h5>
          <button
            type="button"
            class="btn btn-warning pull-right"
            ng-click="logout()"
          >
            Logout
          </button>
        </Breadcrumb>
        <div>
          <div class="jumbotron">
            <h2>Welcome to ((username))'s Nunki player!</h2>
            <br />
            <h4>
              Search by Artist:{" "}
              <input type="text" class="form-control" ng-model="filter_name" />
            </h4>
          </div>
        </div>
      </div>
    );
  }
}

export default DashboardContainer;
