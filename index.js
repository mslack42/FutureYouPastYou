const Discord = require("discord.js");
const config = require("./config.json");
const events = require("events");
const schedule = require("node-schedule");
const NodeCache = require("node-cache");
const chrono = require("chrono-node");

const client_past = new Discord.Client();
const client_future = new Discord.Client();

var eventEmitter = new events.EventEmitter();

const pending_messages = new NodeCache();

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
        if (!pending_messages.has(userId))
        {
            pending_messages.set(userId, content);
            message.author.send("When should I send that message?");
            getTimeResponse(message.channel, userId);
        }
    }
})

async function getTimeResponse(channel, userId)
{
    var timeSuccess = true;
    while (timeSuccess)
    {
        await channel.awaitMessages(isValidMessage, { time: 300000, max: 1, errors: ['time']})
            .then(collected => collected.each(timeMessage => arrangeMessage(userId, timeMessage)))
            .catch(collected => timeSuccess = false);
        if (!pending_messages.has(userId))
        {
            return;
        }
    }
    if (!timeSuccess)
    {
        giveUpOnMessage(userId)
    }
}

function arrangeMessage(userId, timeMessage) {
    var scheduledDate = chrono.parseDate(timeMessage.content);
    if (scheduledDate instanceof Date 
            && !isNaN(scheduledDate)
            && scheduledDate > new Date() ) 
    {
        eventEmitter.emit("myevent", pending_messages.get(userId), userId, scheduledDate);
        timeMessage.author.send("Cool. Will do!");
        timeMessage.author.send(scheduledDate.toLocaleString() + " it is then.");
        pending_messages.del(userId);
        return;
    } else {
        timeMessage.author.send("Sorry, try again maybe?");
    }
}

async function sendMessageFromPast(message, userid, scheduledDate) {
    const user = await client_past.users.fetch(userid);
    var job = schedule.scheduleJob(scheduledDate, () => {
        user.send(message);
        job.cancel();
    })
}

async function giveUpOnMessage(userId) {
    const user = await client_future.users.fetch(userId);
    user.send("dw, come back to me when you're ready");
    pending_messages.del(userId);
    return;
}

eventEmitter.on("myevent", sendMessageFromPast);

client_past.login(config.PAST_YOU_TOKEN);
client_future.login(config.FUTURE_YOU_TOKEN)