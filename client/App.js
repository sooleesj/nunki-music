import React from 'react';
import DashboardContainer from "../containers/DashboardContainer";
import SongsContainer from "../containers/SongsContainer";
import TestContainer from "../containers/TestContainer";
import { Router, Route, browserHistory, IndexRoute } from "react-router";

const App = () => (
    <Router history={browserHistory}>
        <Route path="/">
            <IndexRoute component={DashboardContainer} />
            <Route path="songs" component={SongsContainer} />
            <Route path="test" component={TestContainer} />
        </Route>
    </Router>
);

export default App;
