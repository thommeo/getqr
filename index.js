'use strict';

var fs = require('fs');
var csv = require('csv');
var request = require('request');
var querystring = require('querystring');
var normalizeForSearch = require("normalize-for-search");

// Constants

var url = "http://chart.apis.google.com/chart"

var address = {
	'Germany': {
		organisation: 'AOE GmbH',
		street: 'Borsigstrasse 3',
		city: 'Wiesbaden',
		zipcode: '65205',
		state: '',
		country: 'Germany',
	},
	'US': {
		organisation: 'AOE Inc.',
		street: '700 Airport Blvd, Suite 280',
		city: 'Burlingame',
		zipcode: '94010',
		state: 'CA',
		country: 'USA',
	}
};


var defaultLocation = 'Germany';

var extension = 'png';

// Process

var requests = [];

csv()
.from.path( __dirname + '/data/cards.txt', {
	delimiter: "\t",
	columns: true
})
.to.array( processData )


function processData(rows){

	console.log('Found ' + rows.length + ' rows');

	for ( var i = 0; i < rows.length; i++ ) {

		var row = getRow(rows[i]);
		if (!row.Name) continue;

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
		chs: "500x500",
		cht: "qr",
		chld: "L|4", // L, M, Q, H | margin
		chl: data.join("\n"),
	};

	request( url + '?' + querystring.stringify(postData),
		function(error, respond, body){
			console.log('QR code generated for '+row.Name);
			executeRequest(index + 1);
		}
	)
	.pipe(fs.createWriteStream(__dirname + '/result/'+filename+'.'+extension));

}


function getFilename( row ) {
	return String(normalizeForSearch(row.Name))
		.toLowerCase()
		.replace(/[\s\.\-]+/g, '_')
		.replace('?', '_');
}


function getRow( row ) {
	var nameparts = String(row.Name).split(' ');
	row.FirstName = nameparts.shift();
	row.LastName = nameparts.join(' ');
	return row;
}


function getData( row ) {

	var currentAddress = address[row.Location];
	if (!currentAddress) {
		console.log('Warning! Location was not found for '+ row.Name +', using default: ' + defaultLocation);
		currentAddress = address[defaultLocation];
	}

	var data = [];
	data.push("BEGIN:VCARD");
	data.push("VERSION:3.0");
	data.push("N:" + row.LastName + ";" + row.FirstName);
	data.push("FN:" + row.Name);
	data.push("ORG:" + currentAddress.organisation);
	data.push("TITLE:" + row.Post);
	data.push("TEL;TYPE=work,voice:" + row.PhoneOffice);
	if (row.PhoneMobile) {
		data.push("TEL;TYPE=cell,voice:" + row.PhoneMobile);
	}
	data.push("ADR;TYPE=work:;;" + [ currentAddress.street, currentAddress.city, currentAddress.state, currentAddress.zipcode, currentAddress.country ].join(';') );
	data.push("TEL;TYPE=work,fax:" + row.Fax);
	data.push("URL;TYPE=work:" + row.Website);
	data.push("EMAIL;TYPE=internet,pref:" + row.Email);
	data.push("REV:20130501T195243Z");
	data.push("END:VCARD");

	return data;
}

