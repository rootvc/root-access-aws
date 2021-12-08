const handleEmail = (snsMessage) => {
    let data = {};
    for (let index in Object.keys(snsMessage.data)) {
        const key = Object.keys(snsMessage.data)[index];
        // console.info('(' + index + ') ' + key + ': ' +snsMessage.data[key]);
        data[key] = snsMessage.data[key];
    }

    // commented out fields are valid, but not used
    const message = {
        "bcc": protectNull(data.bcc),
        // "body": data.body,
        "cc": protectNull(data.cc),
        "date": data.date, // TODO: format
        // "folder": data.folder,
        "from": protectNull(data.from),
        "grant_id": data.grant_id,
        "id": data.id,
        // "object": data.object,
        "reply_to": protectNull(data.reply_to),
        // "snippet": data.snippet,
        // "starred": data.starred,
        // "subject": data.subject,
        "to": protectNull(data.to),
        // "unread": data.unread,
        // "labels": protectNull(data.labels),
        // "sync_category": data.sync_category,
    }
    console.info('message: ' + JSON.stringify(message));
}

const protectNull = (list) => {
    if (list == 'null') {
        return null; // or: []?
    } else {
        return JSON.stringify(list); // array object
    }
}

exports.snsNylasMessageHandler = async (event, context) => {
    for (record of event.Records) {
        const snsRecord = record.Sns;
        const snsMessage = JSON.parse(snsRecord.Message);

        switch (snsRecord.MessageAttributes.type.Value) {
            case 'com.nylas.messages.create.inflated':
                handleEmail(snsMessage);
                break;
            default:
                break;
        }
    }
}
