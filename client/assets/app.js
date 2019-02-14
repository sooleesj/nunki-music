var app = angular.module('app', ['ngRoute', 'ngMessages', 'ngCookies']);


app.config(function ($routeProvider) {
    $routeProvider
        .when('/songs', {
            templateUrl: 'partials/songs.html',
            controller: 'SongController'
        })
        .when('/', {
            templateUrl: 'partials/dashboard.html',
            controller: 'DashboardController'
        })
        .otherwise({
            redirectTo: '/'
        });
});