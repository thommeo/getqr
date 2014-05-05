'use strict';

var fs = require('fs');
var csv = require('csv');
var request = require('request');
var querystring = require('querystring');
var normalizeForSearch = require("normalize-for-search");

// Constants

var url = "http://chart.apis.google.com/chart"
var settingsJSONFile = __dirname + '/settings.json';

// Variables

var settings = {};
var requests = [];
var args = [];

// Functions

function main() {

	// Get default settings
	fs.readFile(settingsJSONFile, 'utf8', function (err, data) {

		if (err) {
			console.log('Error: ' + err);
			return;
		}

		settings = JSON.parse(data);
		console.log('Settigns parsed');

		processSettings();

	});

}


function processSettings() {

	// Default settings
	if (!settings.extension) settings.extension = 'png';
	if (!settings.dimensions) settings.dimensions = '500x500';
	if (!settings.cardsCSVFile) settings.cardsCSVFile = 'data/cards.txt';
	if (!settings.resultDir) settings.resultDir = 'result';

	// Get script arguments
	args = process.argv.slice(2);

	// Override settings
	if (args[0]) {
		settings.cardsCSVFile = args[0];
	}

	// Check if the CSV file exists
	fs.exists(settings.cardsCSVFile, function(exists) {
		if (exists) {
			console.log("Using CSV file: " + settings.cardsCSVFile );
			processFile();
		} else {
			console.log("File was not found: " + settings.cardsCSVFile );
		}
	});

}


function processFile() {
	// Read the CSV file
	csv()
	.from.path(settings.cardsCSVFile, {
		delimiter: "\t",
		columns: true
	})
	.to.array( processData )
}


function processData(rows){

	console.log('Found ' + rows.length + ' rows');

	for ( var i = 0; i < rows.length; i++ ) {

		var row = getRow(rows[i]);

		if (!row.Name) {
			console.log("Row "+i+": Name column was not found");
			continue;
		}

		var data = getData(row);
		var filename = getFilename(row);
		requests.push({
			row: row,
			data: data,
			filename: filename
		});
	}

	executeRequest();

}


function executeRequest(index) {

	if (!index) index = 0;

	var requestData = requests[index];
	if (!requestData) {
		console.log('Done');
		return;
	}

	var data = requestData.data;
	var row = requestData.row;
	var filename = requestData.filename;

	var postData = {
		chs: settings.dimensions,
		cht: "qr",
		chld: "L|4", // L, M, Q, H | margin
		chl: data.join("\n"),
	};

	request( url + '?' + querystring.stringify(postData),
		function(error, respond, body){
			console.log('QR code generated for ' + row.Name);
			executeRequest(index + 1);
		}
	)
	.pipe(fs.createWriteStream(__dirname + '/'+ settings.resultDir + '/' + filename + '.' + settings.extension));

}


function getFilename( row ) {
	return String(normalizeForSearch(row.Name))
		.toLowerCase()
		.replace(/[\s\.\-]+/g, '_')
		.replace('?', '_');
}


function getRow( row ) {

	// Name
	var nameparts = String(row.Name).split(' ');
	row.FirstName = nameparts.shift();
	row.LastName = nameparts.join(' ');

	// Twitter
	var twitterURL = String(row.twitter);
	var twitterName = twitterURL.split(/\//).pop();
	row.twitter = twitterName;

	return row;
}


function getData( row ) {

	var currentAddress = settings.address[row.Location];
	if (!currentAddress) {
		console.log('Warning! Location was not found for '+ row.Name +', using default: ' + settings.defaultLocation);
		currentAddress = settings.address[settings.defaultLocation];
	}

	var data = [];
	data.push("BEGIN:VCARD");
	data.push("VERSION:3.0");
	data.push("N:" + row.LastName + ";" + row.FirstName);
	data.push("FN:" + row.Name);
	data.push("ORG:" + currentAddress.organisation);
	if (row.Post) {
		data.push("TITLE:" + row.Post);
	}
	if (row.PhoneOffice) {
		data.push("TEL;TYPE=work,voice:" + row.PhoneOffice);
	}
	if (row.PhoneMobile) {
		data.push("TEL;TYPE=cell,voice:" + row.PhoneMobile);
	}
	data.push("ADR;TYPE=work:;;" + [ currentAddress.street, currentAddress.city, currentAddress.state, currentAddress.zipcode, currentAddress.country ].join(';') );
	if (row.Fax) {
		data.push("TEL;TYPE=work,fax:" + row.Fax);
	}
	if (row.Website) {
		data.push("URL;TYPE=work:" + row.Website);
	}
	if (row.Email) {
		data.push("EMAIL;TYPE=work:" + row.Email);
	}
	if (row.twitter) {
		// data.push("X-SOCIALPROFILE;type=twitter;x-user=" + row.twitter + ":http://twitter.com/" + row.twitter);
		// data.push("X-TWITTER:http://twitter.com/" + row.twitter);
		// data.push("item2.URL:http\://twitter.com/" + row.twitter)
		// data.push("item2.X-ABLabel:Twitter")
		data.push("URL;TYPE=other:http\://twitter.com/" + row.twitter);
	}
	data.push("END:VCARD");

	return data;
}

main();