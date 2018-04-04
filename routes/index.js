var express = require('express');
var router = express.Router();

var weather_controller = require('../controllers/weatherController');

/* GET home page. */
// router.get('/', function(req, res, next) {
//   res.status(200).json({"color": "red"});
// });

router.get('/', weather_controller.index);  


router.get('/weathersuggest', weather_controller.weather_get_data);

module.exports = router;
