#!/usr/bin/env node

var http = require('http'),
	util = require('util'),
	jsdom = require('jsdom'),
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	dateformat = require('dateformat'),
	urlFormat = 'http://www.basketball-reference.com/leagues/NBA_%d_games.html';

function generateScheduleForYear(year, callback) {
	console.log('generating ' + year + '...');
	var url = util.format(urlFormat, year);
	var domOptions = {
		features: {
			FetchExternalResources: false,
			ProcessExternalResources: false
		}
	};
	jsdom.env(url, [], domOptions, function(err, window) {
		if (err) {
			callback(err);
			return;
		}

		console.log(' - created dom for ' + year);
		var gamesTable = window.document.getElementById('games');
		if (!gamesTable) {
			window.close();
			callback();
			return;
		}

		var rows = gamesTable.getElementsByTagName('tbody')[0].getElementsByTagName('tr'),
			teams = {},
			data = {
				year: year,
				source: url,
				teams: [],
				results: []
			};
		for (var i = 0; i < rows.length; i++) {
			var cells = rows[i].getElementsByTagName('td'),
				visitor = cells[2].getElementsByTagName('a')[0].firstChild.nodeValue,
				date = new Date(cells[0].getElementsByTagName('a')[0].firstChild.nodeValue),
				home = cells[4].getElementsByTagName('a')[0].firstChild.nodeValue,
				visitorPoints = parseInt(cells[3].firstChild.nodeValue),
				link = 'http://www.basketball-reference.com' + cells[1].getElementsByTagName('a')[0].getAttribute('href'),
				homePoints = parseInt(cells[5].firstChild.nodeValue);

			if (!teams[visitor]) {
				teams[visitor] = 1;
				data.teams.push(visitor);
			}
			if (!teams[home]) {
				teams[home] = 1;
				data.teams.push(home);
			}

			data.results.push({
				date: dateformat(date, 'yyyy-mm-dd'),
				home: home,
				visitor: visitor,
				homePoints: homePoints,
				visitorPoints: visitorPoints,
				boxScoreLink: link
			});
		}

		window.close();

		data.teams.sort();
		var filename = path.join(__dirname, 'schedules', year + '.json');
		fs.writeFile(filename, JSON.stringify(data, null, '  '), { encoding: 'utf8' }, function(err) {
			console.log('  - done generating ' + year + '...');
			callback(err);
		});
	});
}

var startYear = 1980,
	years = [],
	thisYear = new Date().getFullYear();
for (var i = startYear; i <= thisYear; i++) {
	years.push(i);
}

var start = Date.now();
async.eachLimit(years, 3, generateScheduleForYear, function(err) {
	if (err) {
		console.error('An error occurred', err);
	} else {
		console.log('All done!');
	}

	console.log('... in ' + (Date.now() - start) + 'ms');
	process.exit();
});
