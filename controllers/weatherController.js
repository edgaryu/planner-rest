// var async = require('async');
var request = require('request');

var domainPath = "http://api.wunderground.com/api/";

// Uncomment if testing
var apiKey = process.env.wunderground_apikey;
var methodPath = "/forecast10day/q/";

exports.index = function(req, res) {
  res.status(200).json({"Result": "Route destination arrived."});
};


// ------------------------------
// Retrieve Wunderground API weather information
// param: latitude, longitude
// ------------------------------

function getWeatherData(lat, long, callback){
	// Construct API GET request
	var baseURL = domainPath + apiKey + methodPath;
	var reqURL = baseURL + lat + ',' + long + ".json";

	// Get weather data 
	request(reqURL, function(error, response, body) {
		if (!error && response.statusCode == 200) {

			var resBody = JSON.parse(body);
			var dates = resBody.forecast.simpleforecast.forecastday;

			// dates structure {}
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
				container.dayName = dateObject.date.weekday_short
				container.high = {
					'fahrenheit': parseInt(dateObject.high.fahrenheit),
					'celsius': parseInt(dateObject.high.celsius)
				}; 
				container.low = {
					'fahrenheit': parseInt(dateObject.low.fahrenheit),
					'celsius': parseInt(dateObject.low.celsius)
				}; 
				container.conditions = dateObject.conditions;
				container.pop = parseInt(dateObject.pop);

				return container;
			});

			return callback(null, selectedData.slice(0,7));
		} else {
			return callback(error, null);
		}
	});

}




// ------------------------------
// Score processed weather data
// ------------------------------

// param: noRaining preference, weather conditions, percentage of precipitation
// return: score from 0 to 1
function scoreOnConditions(condition, pop) {
	var conditionsMultiplier = {"conditions": 0.25, "pop": 0.75};
	var rainScores= {"moderate": 0.1, "heavy": 0, "other": 0.3}

	var conditionsScore;
	condition = condition.toLowerCase();
	var conditionDescriptors = condition.split(" ");

	// score on rain condition
	if (conditionDescriptors.includes("rain")) {
		if (conditionDescriptors.includes("moderate")) {
			conditionsScore = rainScores.moderate;
		} 
		else if (conditionDescriptors.includes("heavy")) {
			conditionsScore = rainScores.heavy;
		}
		else {
			conditionsScore = rainScores.other;
		}
	} else {
		conditionsScore = 1;
	}

	// score on pop
	var popScore;
	popScore = 1 - pop/100;

	return (conditionsScore * conditionsMultiplier.conditions + 
		popScore * conditionsMultiplier.pop);


}

// param: minimum temp preference, weather highs, weather lows
// return: score from 0 to 1
function scoreOnMinTemp(minTemp, high, low) {
	var minTempMultiplier = {"magnitude": 0.75, "direction": 0.25};

	// check direction of dist, score ranged [0,1]
	// mintemp lower than high -> pos (satisfies mintemp)
	// mintemp higher than high -> neg (does not satisfy mintemp)
	var directionScore;
	if (minTemp > high) {
		directionScore = 0;
	} else {
		directionScore = 1;
	}

	// check magnitude, score rangeg [0,1]
	// if minTemp is below high, then score 1
	// else determine score from minTemp/high ratio
	var magnitudeScore;
	if (directionScore == 1) {
		magnitudeScore = 1;
	} else {
		if (minTemp == 0) { 
			minTemp += 1;
			high += 1;
		}

		magnitudeScore = 1- (minTemp - high)/minTemp;
	}

 	return (magnitudeScore * minTempMultiplier.magnitude + 
 		directionScore * minTempMultiplier.direction);
}

// param: maximum temperature preference, weather highs, weather lows
// return: score from 0 to 1
function scoreOnMaxTemp(maxTemp, high, low) {
	var maxTempMultiplier = {"magnitude": 0.75, "direction": 0.25};

	// check direction of dist, score ranged [0,1]
	// mintemp lower than high -> pos (satisfies maxtemp)
	// mintemp higher than high -> neg (does not satisfy maxtemp)
	var directionScore;
	if (maxTemp < high) {
		directionScore = 0;
	} else {
		directionScore = 1;
	}

	// check magnitude, score rangeg [0,1]	
	// if maxTemp is below high, then score 1
	// else determine score from maxTemp/high ratio
	var magnitudeScore;
	if (directionScore == 1) {
		magnitudeScore = 1;
	} else {
		if (maxTemp == 0) { 
			maxTemp += 1;
			high += 1;
		}

		magnitudeScore = 1- (high - maxTemp)/maxTemp;
	}

 	return (magnitudeScore * maxTempMultiplier.magnitude + 
 		directionScore * maxTempMultiplier.direction);


}

// function simpleSort(weatherScores) {
// 	// convert dict to array
// 	var items = Object.keys(weatherScores).map(function(key) {
// 	    return [key, weatherScores[key]];
// 	});

// 	// Sort the array based on score
// 	items.sort(function(first, second) {
// 	    return second[1] - first[1];
// 	});

// 	return items;

// }


// ------------------------------
// Sort score combinations
// ------------------------------

// param: weatherScores, user prefs for daysBetween and daysPerWeek
// return: array of days with best combined sum of scores
function weatherSort(weatherScores, daysBetween, minDaysPerWeek) {
  
    var gap;
    if (daysBetween === undefined) {
       gap = 0;
    } else {
      gap = parseInt(daysBetween);
    }
  
    var daysPerWeek;
    if (minDaysPerWeek === undefined) {
    	daysPerWeek = 1;
    } else {
    	daysPerWeek = parseInt(minDaysPerWeek);
    }
 
    var allKeys = Object.keys(weatherScores);
    var highestSum = 0;
    var bestDays = [];
    var l = Object.keys(allKeys).length;

    // find combinations of days and summing their scores.
    // running multiple for loops depends on daysPerWeek
    for (var i = 0; i < l - daysPerWeek + 1; i++) {

      if (daysPerWeek < 2) {
        var iSum = weatherScores[i];
          if (iSum >= highestSum) {
            highestSum = iSum;
            bestDays.push( { "first": i, "sum": iSum} );
          }
        continue;
      }
      
      for (var j = i+1 + gap; j < l; j++) {
        
        if (daysPerWeek < 3) {
          var jSum = weatherScores[i] + weatherScores[j];
          if (jSum >= highestSum) {
            highestSum = jSum;
            bestDays.push( { "first": i, "second": j, "sum": jSum} );
          }
          continue;
        }
                
        for (var k = j+1 + gap; k < l; k++) {
          
          var kSum = weatherScores[i] + weatherScores[j] + weatherScores[k];
          if (kSum >= highestSum) {
            highestSum = kSum;
            bestDays.push( { "first": i, "second": j, "third": k, "sum": kSum} );
          }
        }
      }
      
    }
  
    // return best 3 combinations
    bestDays = bestDays.slice(-3);

    return bestDays;
}



// Process based on weatherOptions: daysBetween, minDaysPerWeek, noRaining, minTemp,
// maxTemp
// Return array of length minDaysPerWeek, containing indices of best days
function processWeatherData(weatherData, queries) {
	var multiplier = {"conditions": 0.5, "minTemp": 0.25, "maxTemp": 0.25};
	var {daysBetween, minDaysPerWeek, noRaining, minTemp, maxTemp} = queries; 
	var weatherScores = {};

	var checkRaining = (noRaining != undefined && noRaining == "true");
	var checkMinTemp = minTemp != undefined;
	var checkMaxTemp = maxTemp != undefined;

	// first score on noRaining, minTemp, maxTemp
	for (var i = 0; i < weatherData.length; i++) {
		var thisWeather = weatherData[i];
		var thisScore = 0.0;

		// check rain using pop and conditions
		if (checkRaining) {
			thisScore += (scoreOnConditions(thisWeather.conditions, thisWeather.pop) 
				* multiplier.conditions);
		}
		
		if (checkMinTemp) {
			thisScore += (scoreOnMinTemp(parseInt(minTemp), thisWeather.high.fahrenheit, thisWeather.low.fahrenheit) 
				* multiplier.minTemp);
		}

		if (checkMaxTemp) {
			thisScore += (scoreOnMaxTemp(parseInt(maxTemp), thisWeather.high.fahrenheit, thisWeather.low.fahrenheit ) 
				* multiplier.maxTemp);
		}


		weatherScores[i] = thisScore;
		weatherData[i]["score"] = thisScore;
		// console.log(thisWeather);
	}

	// for (var i = 0; i < weatherData.length; i++) {
	// 	console.log("min: " + minTemp + " ... "  + "max: " + maxTemp + " ... " + 
	// 		"high: " + weatherData[i]["high"]["fahrenheit"] + " ... " +
	// 		weatherData[i]["score"]);
	// }

	return weatherSort(weatherScores, daysBetween, minDaysPerWeek);
}


// ------------------------------
// Handle GET request
// ------------------------------

// Verify if latitude and longitude are valid
function verifyLatLong(lat, long) {
	if (lat == undefined || long == undefined) return false;
	if (lat < -90 || lat > 90) return false;
	if (long < -180 || long > 180) return false;
	return true;
}

// Response:
// weatherData: [] of length 7
// suggestions: [] of length minDaysPerWeek
exports.weather_get_data = function(req, res) {

	var lat = req.query.latitude;
	var long = req.query.longitude;

	// Verify lat and long
	if (!verifyLatLong(lat, long)) {
		return res.status(400).send({message: "Latitude or longitude is not correct"});
	} else {
		lat = parseFloat(lat);
		long = parseFloat(long);
	}

	

	// For testing
	// var weatherData = [{"date":{"month":4,"day":4,"year":2018},"high":{"fahrenheit":66,"celsius":18},"low":{"fahrenheit":55,"celsius":13},"conditions":"Overcast","pop":10},{"date":{"month":4,"day":5,"year":2018},"high":{"fahrenheit":67,"celsius":19},"low":{"fahrenheit":55,"celsius":13},"conditions":"Clear","pop":10},{"date":{"month":4,"day":6,"year":2018},"high":{"fahrenheit":71,"celsius":22},"low":{"fahrenheit":59,"celsius":15},"conditions":"Partly Cloudy","pop":10},{"date":{"month":4,"day":7,"year":2018},"high":{"fahrenheit":67,"celsius":19},"low":{"fahrenheit":55,"celsius":13},"conditions":"Partly Cloudy","pop":10},{"date":{"month":4,"day":8,"year":2018},"high":{"fahrenheit":74,"celsius":23},"low":{"fahrenheit":57,"celsius":14},"conditions":"Partly Cloudy","pop":0},{"date":{"month":4,"day":9,"year":2018},"high":{"fahrenheit":80,"celsius":27},"low":{"fahrenheit":58,"celsius":14},"conditions":"Partly Cloudy","pop":0},{"date":{"month":4,"day":10,"year":2018},"high":{"fahrenheit":73,"celsius":23},"low":{"fahrenheit":57,"celsius":14},"conditions":"Partly Cloudy","pop":0},{"date":{"month":4,"day":11,"year":2018},"high":{"fahrenheit":70,"celsius":21},"low":{"fahrenheit":55,"celsius":13},"conditions":"Partly Cloudy","pop":0},{"date":{"month":4,"day":12,"year":2018},"high":{"fahrenheit":71,"celsius":22},"low":{"fahrenheit":55,"celsius":13},"conditions":"Clear","pop":0},{"date":{"month":4,"day":13,"year":2018},"high":{"fahrenheit":82,"celsius":28},"low":{"fahrenheit":54,"celsius":12},"conditions":"Clear","pop":0}];
	// var scores = processWeatherData(weatherData.slice(0,7), req.query);
	// res.send(scores);
	// res.send(req.query);

	getWeatherData(lat, long, function(err, weatherData) {
		if(!err){
			// process data
			var response = {};
			response["weatherData"] = weatherData;

			// if no weatherOptions, just send weatherData
			// else, do processing
			if (Object.keys(req.query).length > 2) {
				response["suggestions"] = processWeatherData(weatherData, req.query);
			} 

			res.send(response);
		}
		else{
			res.send(err);
		}
	});


};