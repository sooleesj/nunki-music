import React from 'react';
import '../css/Breadcrumb.css';

const Breadcrumb = () => {

  return (
    <div className="breadcrumb">
      <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <a class="navbar-brand" href="#">Nunki App</a>
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="navbar-nav mr-auto">
            <li class="nav-item active">
              <a class="nav-link" href="#">Home <span class="sr-only">(current)</span></a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#">Link</a>
            </li>
          </ul>
          <button type="button" class="btn btn-warning pull-right" ng-click='logout()'>Logout</button>
        </div>
      </nav>
    </div>
  );
}


export default Breadcrumb;