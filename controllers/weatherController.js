// var async = require('async');
var request = require('request');

var domainPath = "http://api.wunderground.com/api/";
var apiKey = "c0a8c0dbcccf9934";
var methodPath = "/forecast10day/q/";

exports.index = function(req, res) {
  res.status(200).json({"color": "red"});
};


function getWeatherData(callback){
	// Construct API GET request
	var baseURL = domainPath + apiKey + methodPath;
	var lat = 34.052234;
	var long = -118.243685;
	var reqURL = baseURL + lat + ',' + long + ".json";

	request(reqURL, function(error, response, body) {
		if (!error && response.statusCode == 200) {

			// result = JSON.stringify(JSON.parse(body));

			var resBody = JSON.parse(body);
			var dates = resBody.forecast.simpleforecast.forecastday;
			// date- month, day, year
			// high- farenheit, celsius
			// low- farenheit, celsius
			// conditions
			// pop
			var selectedData = dates.map(function(dateObject) {
				var container = {};
				container.date = {
					'month': dateObject.date.month,
					'day': dateObject.date.day,
					'year': dateObject.date.year
				};
				container.high = dateObject.high;
				container.low = dateObject.low;
				container.conditions = dateObject.conditions;
				container.pop = dateObject.pop;

				return container;
			});

			return callback(null, selectedData);
		} else {
			return callback(error, null);
		}
	});
}


// REST req params should be
// Make GET request to wunderground api
// Then process that data
// Make recommendations
exports.weather_get_data = function(req, res) {

	// get query params

	getWeatherData(function(err, data) {
		if(!err){
			res.send(data);
		}
		else{
			res.send(err);
		}
	});


};

// correct api request for LA
// http://api.wunderground.com/api/c0a8c0dbcccf9934/forecast10day/q/34.052234,-118.243685.json