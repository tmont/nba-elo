#! /usr/bin/env node

var fs = require('fs'),
	path = require('path'),
	async = require('async');

fs.readdir(path.join(__dirname, 'schedules'), function(err, filenames) {
	if (err) {
		console.error(err);
		process.exit();
	}

	var defaultRating = 1200;

	function getKFactor(info) {
		return 800 / Math.max(1, info.wins + info.losses);
	}

	function calculateStandings(filename, callback) {
		console.log('calculating standings from ' + filename);
		var season = require(path.join(__dirname, 'schedules', filename)),
			info = {},
			i;

		//initialize ratings for each team
		for (i = 0; i < season.teams.length; i++) {
			info[season.teams[i]] = {
				rating: defaultRating,
				log: [],
				wins: 0,
				losses: 0
			};
		}

		for (i = 0; i < season.results.length; i++) {
			var result = season.results[i],
				homeInfo = info[result.home],
				visitorInfo = info[result.visitor],
				currentHomeRating = homeInfo.rating,
				currentVisitorRating = visitorInfo.rating,
				pHome = 1 / (1 + Math.pow(10, (currentVisitorRating - currentHomeRating) / 400)),
				pVisitor = 1 / (1 + Math.pow(10, (currentHomeRating - currentVisitorRating) / 400)),
				homeResult = 'D',
				visitorResult = 'D';

			if (result.homePoints > result.visitorPoints) {
				homeInfo.wins++;
				visitorInfo.losses++;
				homeInfo.rating = currentHomeRating + getKFactor(homeInfo) * pVisitor;
				visitorInfo.rating = currentVisitorRating - getKFactor(visitorInfo) * pVisitor;
				homeResult = 'W';
				visitorResult = 'L';
			} else if (result.homePoints < result.visitorPoints) {
				homeInfo.losses++;
				visitorInfo.wins++;
				homeInfo.rating = currentHomeRating - getKFactor(homeInfo) * pHome;
				visitorInfo.rating = currentVisitorRating + getKFactor(visitorInfo) * pHome;
				homeResult = 'L';
				visitorResult = 'W';
			}

			homeInfo.log.push({
				diff: homeInfo.rating - currentHomeRating,
				newRating: homeInfo.rating,
				result: homeResult + ' ' + result.homePoints + '-' + result.visitorPoints + ' vs ' + result.visitor + ' on ' + result.date
			});
			visitorInfo.log.push({
				diff: visitorInfo.rating - currentVisitorRating,
				newRating: visitorInfo.rating,
				result: visitorResult + ' ' + result.visitorPoints + '-' + result.homePoints + ' vs ' + result.home + ' on ' + result.date
			});
		}

		var standings = [];
		Object.keys(info).forEach(function(team) {
			standings.push({
				team: team,
				rating: info[team].rating,
				wins: info[team].wins,
				losses: info[team].losses,
				log: info[team].log
			});
		});

		//sort by rating -> wins -> losses -> name
		standings.sort(function(a, b) {
			if (a.rating === b.rating) {
				if (a.wins === b.wins) {
					if (a.losses === b.losses) {
						return a.team < b.team ? -1 : 1;
					}

					return a.losses < b.losses ? -1 : 1;
				}

				return a.wins < b.wins ? 1 : -1;
			}

			return a.rating < b.rating ? 1 : -1;
		});

		var standingsFile = path.join(__dirname, 'elo-standings', season.year + '.json');
		fs.writeFile(standingsFile, JSON.stringify({ standings: standings }, null, '  '), { encoding: 'utf8' }, function(err) {
			console.log('  - calculations complete for ' + season.year);
			callback(err);
		});
	}

	var start = Date.now();
	async.eachLimit(filenames, 5, calculateStandings, function(err) {
		if (err) {
			console.error(err);
		} else {
			console.log('All done!');
		}

		console.log('... in ' + (Date.now() - start) + 'ms');
		process.exit();
	});
});


