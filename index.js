'use strict';

var fs = require('fs');
var csv = require('csv');
var request = require('request');
var normalizeForSearch = require("normalize-for-search");

// Constants

var url = 'http://online-barcode-generator.com/';

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

	var postData = data;

	request.post(url, { form: postData }, function(error, respond, body){
		console.log('QR code generated for '+row.Name);

		// Downloa the file
		var parts = String(body).split('#');
		var code = parts[4];
		request(url + '/temp/' + code + '.' + extension)
			.pipe(fs.createWriteStream(__dirname + '/result/'+filename+'.'+extension));

		// Invoke next request
		executeRequest(index + 1);

	});

}


function getFilename( row ) {
	return String(normalizeForSearch(row.Name))
		.toLowerCase()
		.replace(/[\s\.\-]+/g, '_');
}


function getRow( row ) {
	var nameparts = String(row.Name).split(' ');
	row.FirstName = nameparts[0];
	row.LastName = nameparts[1];
	return row;
}


function getData( row ) {

	var currentAddress = address[row.Location];
	if (!currentAddress) {
		console.log('Warning! Location was not found for '+ row.Name +', using default: ' + defaultLocation);
		currentAddress = address[defaultLocation];
	}

	var data = {
		codetype: 'qrcode',
		qrtype: '6',
		text2display: '',
		hlink: '',
		phone: row.PhoneOffice,
		email: row.Email,
		mefname: row.FirstName,
		melname: row.LastName,
		meemail: row.Email,
		mephone: row.PhoneOffice,
		mepobox: '',
		meroom: '',
		mehouse: '',
		mestreet: currentAddress.street,
		mecity: currentAddress.city,
		mestate: currentAddress.state,
		mezipcode: currentAddress.zipcode,
		mecountry: currentAddress.country,
		vcfname: row.FirstName,
		vclname: row.LastName,
		vctitle: row.Post,
		vcorganisation: currentAddress.organisation,
		vcemail: row.Email,
		vcphone: row.PhoneOffice,
		vcpobox: '',
		vchouse: '',
		vcstreet: currentAddress.street,
		vccity: currentAddress.city,
		vcstate: currentAddress.state,
		vczipcode: currentAddress.zipcode,
		vccountry: currentAddress.country,
		vcurl: row.Website,
		wifitype: 'nopass',
		wifissid: '',
		wifipass: '',
		black: '#000000',
		white: '#ffffff',
		res: '1',
		level: 'L',
		generate: '1',
	};

	return data;
}

