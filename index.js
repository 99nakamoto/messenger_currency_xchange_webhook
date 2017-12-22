/*
 * Starter Project for Messenger Platform Quick Start Tutorial
 *
 * Remix this as the starting point for following the Messenger Platform
 * quick start tutorial.
 *
 * https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start/
 *
 */

'use strict';

// Imports dependencies and set up http server
const
    request = require('request'),
    sync_request = require('sync-request'),
    express = require('express'),
    body_parser = require('body-parser'),
    assert = require('assert'),
    app = express().use(body_parser.json()); // creates express http server

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {

    // Parse the request body from the POST
    let body = req.body;

    // Check the webhook event is from a Page subscription
    if (body.object === 'page') {

        // Iterate over each entry - there may be multiple if batched
        body.entry.forEach(function (entry) {

            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);


            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }

        });

        // Return a '200 OK' response to all events
        res.status(200).send('EVENT_RECEIVED');

    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});


app.get('/', (req, res) => {
    var url = "mongodb://ran:wei@ds163656.mlab.com:63656/mongo_xchange";
    var collectionName = "currency_rates";

    
    // Connect to the db
    var MongoClient = require('mongodb').MongoClient;
    MongoClient.connect(url, function (err, db) {
        db.collection(collectionName, function (err, collection) {
            // update, can also use collection.save({_id:"abc", user:"David"},{w:1}, callback)
            collection.update(
                {Currency: "SGD"}, 
                {Currency: "SGD", Rate:194}, 
                {upsert:true, w: 1},
                function(err, result) {
                    collection.findOne({Currency:"SGD"}, function(err, item) {
                        assert.equal(null, err);
                        assert.equal(194, item.Rate);
                        db.close();
                    });
                }
            );

            // find
            collection.find().toArray(function(err, items) {
                if(err) throw err;    
                console.log("print all items in MongoDB: ");
                console.log(items);
            });
        });
    });

    res.send('Hello World!');
});



// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {

    /** UPDATE YOUR VERIFY TOKEN **/
    const VERIFY_TOKEN = "token";

    // Parse params from the webhook verification request
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Check if a token and mode were sent
    if (mode && token) {

        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Respond with 200 OK and challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

function hiMessage(recipientId) {
    var response = {
            "text": `
Thanks for using Currency Xchange Messenger Bot!
Try to send a number.
      `
    }

    return response;
}

function convertCurrency(receivedNumber) {
    var response;
    
    var RatesApi = require('openexchangerates-api');
    var client = new RatesApi({
      appId: 'adbe1e817ef84112ba152d896d965b8e'
    });
    
    response = client.latest({base: 'USD'}, function handleLatest(err, data) {
      if (err) {
        throw err;
      }
      else {
        // TODO: this is async call, save this to Mongo and use it.
        // console.dir("rate is " + data.rates.SGD);
      }
    });

    var res = sync_request('GET', 'https://openexchangerates.org/api/latest.json?app_id=adbe1e817ef84112ba152d896d965b8e');
    var json = JSON.parse(res.body.toString());
    
    var resultNumber = receivedNumber / json.rates.SGD;
    response = {
        "text": receivedNumber + " SGD is equivalent of " + resultNumber + " USD"
    }

    return response;
}

// Handles messages events
function handleMessage(sender_psid, received_message) {
    let response;

    // Checks if the message contains text
    if (received_message.text) {

        var messageText = received_message.text;

        switch (messageText.replace(/[^\w\s]/gi, '').trim().toLowerCase()) {
            case 'hello':
            case 'hi':
                response = hiMessage(sender_psid);
                break;
            default:
                var numericMessage = parseInt(messageText);
                if (isNaN(numericMessage)) {
                    response = {
                        "text": `You sent the message: "${messageText}". Now send me an number!`
                    }
                } else {
                    response = convertCurrency(numericMessage);
                }
        }
    } else if (received_message.attachments) {
        // Get the URL of the message attachment
        let attachment_url = received_message.attachments[0].payload.url;
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Is this the right picture?",
                        "subtitle": "Tap a button to answer.",
                        "image_url": attachment_url,
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Yes!",
                                "payload": "yes",
              },
                            {
                                "type": "postback",
                                "title": "No!",
                                "payload": "no",
              }
            ],
          }]
                }
            }
        }
    }

    // Sends the response message
    callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
    let response;

    // Get the payload for the postback
    let payload = received_postback.payload;

    // Set the response based on the postback payload
    if (payload === 'yes') {
        response = {
            "text": "Thanks!"
        }
    } else if (payload === 'no') {
        response = {
            "text": "Oops, try sending another image."
        }
    }
    // Send the message to acknowledge the postback
    callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": {
            "access_token": PAGE_ACCESS_TOKEN
        },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!')
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}
