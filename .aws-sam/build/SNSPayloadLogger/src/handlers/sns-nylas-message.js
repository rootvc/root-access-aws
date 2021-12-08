handleEmail = (snsMessage) => {
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
        "labels": protectNull(data.labels),
        // "sync_category": data.sync_category,
    }
    console.info('message: ' + JSON.stringify(message));
}

protectNull = (list) => {
    if (list = 'null') {
        return null;
    } else {
        JSON.encode(list);
    }
}

exports.snsNylasMessageHandler = async (event, context) => {
    // const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    const snsMessage = JSON.parse(event.Message);

    switch (event.MessageAttributes.type.Value) {
        case 'com.nylas.messages.create.inflated':
            handleEmail(snsMessage);
            break;
        default:
            break;
    }
}
