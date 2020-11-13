const Discord = require("discord.js");
const config = require("./config.json");
const events = require("events");
const schedule = require("node-schedule");
const NodeCache = require("node-cache");
const chrono = require("chrono-node");

const client_past = new Discord.Client();
const client_future = new Discord.Client();

var eventEmitter = new events.EventEmitter();

const conversation_tracker = new NodeCache();
const pending_messages = new NodeCache();

client_future.on("message", function(message) {
    if (message.author.bot) return;
    if (message.channel.type == "dm") {
        var userId = message.author.id;
        var content = message.content;
        if (isNewConversation(userId)) {
            message.author.send("Hi. Is this your first time?");
            conversation_tracker.set(userId, "ready");
        }
        if (isReady(userId)) {
            conversation_tracker.set(userId, "inProgress");
            pending_messages.set(userId, content);
            message.author.send("When should I send that message?");
            return;
        } else if (isInProgress(userId)) {
            var scheduledDate = chrono.parseDate(content);
            if (scheduledDate instanceof Date 
                && !isNaN(scheduledDate)
                && scheduledDate > new Date() ) {
                eventEmitter.emit("myevent", pending_messages.get(userId), userId, scheduledDate);
                message.author.send("Cool. Will do!");
                message.author.send(scheduledDate.toLocaleString() + " it is then.");
                conversation_tracker.set(userId, "ready");
                return;
            } else {
                message.author.send("Sorry, try again maybe?");
                return;
            }
        }
    }
})

function isNewConversation(id) {
    return !conversation_tracker.has(id);
}

function isReady(id) {
    return conversation_tracker.get(id) === "ready";
}

function isInProgress(id) {
    return conversation_tracker.get(id) === "inProgress";
}

async function sendMessageFromPast(message, userid, scheduledDate) {
    const user = await client_past.users.fetch(userid);
    var job = schedule.scheduleJob(scheduledDate, () => {
        user.send(message);
        job.cancel();
    })
}

eventEmitter.on("myevent", sendMessageFromPast);

client_past.login(config.PAST_YOU_TOKEN);
client_future.login(config.FUTURE_YOU_TOKEN)