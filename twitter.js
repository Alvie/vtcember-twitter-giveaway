const https = require('https');
const fs = require('fs');

// const apiKey = 'KEY';
// const apiSecret = 'SECRET';

// only need bearer for this
const apiBearer = 'BEARER';

// Apologies for kinda crappy code, it was created quickly to
// be able to choose random users for the #VTCember giveaway
// Does the job I guess, it can definitely be improved though

function getApiOptions(nextToken = null) {
	// adjust start and end date as required (ISO format)
	const startDate = '2021-12-02T22:00:00Z';
	const endDate = '2021-12-03T22:00:01Z';
	// search for tweets containing #vtcember not from @cryptovertedcom, not from @vertcoin
	// quote tweets are fine, but not retweets. Also, request user information for anti-spam
	const twitterURL = new URL(`https://api.twitter.com/2/tweets/search/recent?query=%23vtcember%20-from%3Acryptovertedcom%20-from%3Avertcoin%20-is%3Aretweet&start_time=${startDate}&end_time=${endDate}&expansions=author_id&user.fields=created_at,profile_image_url`);

	// Build path name with path and query string
	let pathName = twitterURL.pathname + twitterURL.search;

	// If next token is provided, append it to path name to get the next page of tweets
	if (nextToken !== null) {
		pathName += `&next_token=${nextToken}`;
	}

	// build options with bearer authorization for API
	const twitterApiOptions = {
		hostname: twitterURL.hostname,
		path: pathName,
		method: 'GET',
		headers: {
			'authorization': 'Bearer ' + apiBearer,
			'accept': '*/*'
		}
	}

	return twitterApiOptions;
}

let lastValidCreationDate = new Date('2021-12-01T00:00:00Z');

let metaNextToken = '';
let validTweetsArray = [];
let authorCountJson = {};
let invalidUserArray = [];

function getRandomInt(max) {
	return Math.floor(Math.random() * max);
}

function filterTweets(tweetsData) {
	let parsedTweetsData = JSON.parse(tweetsData);

	for (const tweetObject of parsedTweetsData.data) {
		// skip tweet if the user isnt valid (no profile pic / account too new)
		if (invalidUserArray.includes(tweetObject.author_id)) {
			continue;
		}

		let tweetDetails = {};

		// find the user in the list that the twitter api provides
		const userObject = parsedTweetsData.includes.users.find(item => {
			return item.id === tweetObject.author_id;
		});

		// check if user has default image and add them to invalid list if so, and skip
		if (userObject.profile_image_url === 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png') {
			invalidUserArray.push(userObject.id);
			continue;
		}

		// check if user was created in dec 2021 or after and add to invalid list if so, and skip
		const userCreationDate = new Date(userObject.created_at);
		if (userCreationDate >= lastValidCreationDate) {
			invalidUserArray.push(userObject.id);
			continue;
		}

		// count how many tweets the user has submitted for giveaway,
		// if no tweets submitted, initialise to 0, and skip if user has submitted
		// 5 tweets already
		if (authorCountJson[tweetObject.author_id] == null) {
			authorCountJson[tweetObject.author_id] = 0;
		} else if (authorCountJson[tweetObject.author_id] >= 5){
			continue;
		}

		// collect relevant details
		tweetDetails.username = userObject.username;
		tweetDetails.name = userObject.name;
		tweetDetails.userId = tweetObject.author_id;
		tweetDetails.tweetId = tweetObject.id;
		tweetDetails.text = tweetObject.text;

		// push relevant details to array and increment author count
		authorCountJson[tweetObject.author_id] += 1;
		validTweetsArray.push(tweetDetails);	
	}

	// check if twitter api provided meta next_token (i.e. are there still more results to consider)
	metaNextToken = parsedTweetsData.meta.next_token;

	// if so, continue the search algorithm for the next page of tweets
	if (metaNextToken != null) {
		searchApi(getApiOptions(metaNextToken));	
	} else {
		// if on last page of tweets,  choose 3 random users from all tweets
		let tweetArrayLength = validTweetsArray.length;

		fs.writeFile('./tweets.json', JSON.stringify(validTweetsArray), err => {
			if (err) {
			  console.error(err);
			  return;
			}
		});

		let randomInt1 = getRandomInt(tweetArrayLength);
		randomTweet1 = validTweetsArray[randomInt1];
		// remove the first chosen tweet from array
		validTweetsArray = validTweetsArray.filter(item => item !== randomTweet1);

		let randomInt2 = getRandomInt(tweetArrayLength - 1);
		randomTweet2 = validTweetsArray[randomInt2];
		// remove the second chosen tweet from array
		validTweetsArray = validTweetsArray.filter(item => item !== randomTweet2);

		let randomInt3 = getRandomInt(tweetArrayLength - 2);
		randomTweet3 = validTweetsArray[randomInt3];

		// Log winning tweets / users
		console.log(randomTweet1);
		console.log(randomTweet2);
		console.log(randomTweet3);
	}
}

async function searchApi(twitterApiOptions) {
	let tweetsData = '';

	const req = https.request(twitterApiOptions, res => {
		console.log(`statusCode: ${res.statusCode}`);
		res.on('data', data => {
			tweetsData += data;
		});

		res.on('end', () => {
			// Once the response has fully sent, run the filterTweets() function
			// over the data submitted by the api
			filterTweets(tweetsData)
		});
	});

	req.on('error', error => {
		console.error(error);
	});

	req.end();
}

// start search
searchApi(getApiOptions());