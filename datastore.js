const mongoose = require("mongoose");
const config = require("./config.json");
const events = require("events");

mongoose.connect(config.DB_CONNECTION_STRING, { useNewUrlParser: true, useUnifiedTopology: true });
var db = mongoose.connection;

var dbEventEmitter = new events.EventEmitter();

db.once("open", function() {
    console.log("Database connection established");
    dbEventEmitter.emit("dbConnect");
})


const Schema = mongoose.Schema;

let messageToSend = new Schema(
    {
        userId: {
            type: String
        },
        deliveryTime: {
            type: Date
        },
        messageContent: {
            type: String
        }
    },
    { collection: "Messages"}
)
var messageModel = mongoose.model("messageToSend", messageToSend);

async function saveMessage(userId, message, time, callback)
{
    await messageModel.create({
        "userId":userId,
        "deliveryTime":time,
        "messageContent": message
    }, (err, doc) => {
        if (err)
        {
            console.log(err);
        }
        callback(doc);
    });
}

async function fetchMessages(cutoffTime)
{
   const results = await messageModel.find({deliveryTime: {$lt:cutoffTime}}, (err, messages) =>
    {
        if (err){
            console.log(err);
            return;
        }
    });
    return results;
}

function deleteMessage(databaseId)
{
    messageModel.findByIdAndDelete(databaseId, (err, res) => {
        if (err) {
            console.log(err);
        }
    });
}

module.exports = {saveMessage, fetchMessages, deleteMessage, dbEventEmitter};