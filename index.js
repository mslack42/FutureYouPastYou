const Discord = require("discord.js");
const config = require("./config.json");
const events = require("events");
const schedule = require("node-schedule");
const NodeCache = require("node-cache");
const chrono = require("chrono-node");
const datastore = require("./datastore");
const _ = require('lodash');

const client_past = new Discord.Client();
const client_future = new Discord.Client();

var eventEmitter = new events.EventEmitter();

const in_progress_users = new NodeCache();

function isValidMessage(m)
{
    return !m.author.bot && m.type === "DEFAULT";
}

client_future.on("message", function(message) {
    if (!isValidMessage(message)) {
        return;
    }
    if (message.channel.type == "dm") {
        var userId = message.author.id;
        var content = message.content;
        if (!in_progress_users.has(userId))
        {
            in_progress_users.set(userId, userId);
            message.author.send("When should I send that message?");
            getTimeResponse(message.channel, userId, content);
        }
    }
})

async function getTimeResponse(channel, userId, content)
{
    var timedOut = false;
    while (!timedOut)
    {
        await channel.awaitMessages(isValidMessage, { time: 300000, max: 1, errors: ['time']})
            .then(collected => collected.each(timeMessage => arrangeMessage(userId, timeMessage, content)))
            .catch(collected => timedOut = true);
        if (!in_progress_users.has(userId))
        {
            return;
        }
    }
    if (timedOut)
    {
        giveUpOnMessage(userId);
    }
}

function arrangeMessage(userId, timeMessage, content) {
    var scheduledDate = chrono.parseDate(timeMessage.content);
    if (scheduledDate instanceof Date 
            && !isNaN(scheduledDate)
            && scheduledDate > new Date() ) 
    {
        timeMessage.author.send("Cool. Will do!");
        timeMessage.author.send(scheduledDate.toLocaleString() + " it is then.");
        var cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() + 2);
        datastore.saveMessage(userId, content, scheduledDate, function(doc) {
            var docId = doc._id;
            if (scheduledDate < cutoffDate)
            {
                eventEmitter.emit("myevent", content, userId, scheduledDate, docId.toString());
            }
        });
        in_progress_users.del(userId);
    } else {
        timeMessage.author.send("Sorry, try again maybe?");
    }
}

async function sendMessageFromPast(message, userid, scheduledDate, jobId) {
    const user = await client_past.users.fetch(userid);
    var job = schedule.scheduleJob(jobId.toString(), scheduledDate, () => {
        user.send(message);
        job.cancel();
        datastore.deleteMessage(jobId);
    })
}

async function apologiseForMissedMessage(message, userid, deliveryTime, jobId) {
    const user = await client_past.users.fetch(userid);
    const apologyTime = new Date();
    apologyTime.setSeconds(apologyTime.getSeconds() + 10);
    var job = schedule.scheduleJob(jobId.toString(), apologyTime, () => {
        user.send("I should have said this at " + deliveryTime.toLocaleString() + " but... " +message);
        job.cancel();
        datastore.deleteMessage(jobId);
    })
}

async function giveUpOnMessage(userId) {
    const user = await client_future.users.fetch(userId);
    user.send("dw, come back to me when you're ready");
    in_progress_users.del(userId);
    return;
}

eventEmitter.on("myevent", sendMessageFromPast);

async function scheduleFromDatabase() {
    var cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() + 2);
    const storedMessages = await datastore.fetchMessages(cutoffTime);
    storedMessages.forEach(item => {
        var jobId = item._id;
        if (isNewJob(jobId.toString()))
        {
            if (item.deliveryTime >= new Date())
            {
                sendMessageFromPast(item.messageContent, item.userId, item.deliveryTime, jobId);
            } else {
                apologiseForMissedMessage(item.messageContent, item.userId, item.deliveryTime, jobId);
            }
        }
    });
    if (isNewJob("nextLoad"))
    {
        var nextLoadTime = new Date();
        nextLoadTime.setHours(nextLoadTime.getHours() + 1);
        schedule.scheduleJob("nextLoad", nextLoadTime, () => {
            scheduleFromDatabase();
        });
    }
}

function isNewJob(jobId) {
    const jobNames = _.keys(schedule.scheduledJobs);
    return !jobNames.includes(jobId);
}

datastore.dbEventEmitter.on("dbConnect", scheduleFromDatabase);

client_past.on("ready", function() {
    console.log("Past connected");
});

client_future.on("ready", function() {
    console.log("Future connected");
});

client_past.login(config.PAST_YOU_TOKEN);
client_future.login(config.FUTURE_YOU_TOKEN);