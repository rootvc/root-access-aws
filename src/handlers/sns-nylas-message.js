const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_TOKEN);

const handleEmail = async (snsMessage) => {
    let data = {};
    for (let index in Object.keys(snsMessage.data)) {
        const key = Object.keys(snsMessage.data)[index];
        // console.info('(' + index + ') ' + key + ': ' +snsMessage.data[key]);
        data[key] = snsMessage.data[key];
    }

    // commented out fields are valid, but not used
    const message = {
        "bcc": protectNull(data.bcc, []),
        // "body": data.body,
        "cc": protectNull(data.cc, []),
        "date": epochToDateTimeZone(data.date),
        // "folder": data.folder,
        "from": protectNull(data.from, []),
        "grant_id": data.grant_id,
        "message_id": data.id,
        // "object": data.object,
        "reply_to": protectNull(data.reply_to),
        // "snippet": data.snippet,
        // "starred": data.starred,
        // "subject": data.subject,
        "to": protectNull(data.to, []),
        // "unread": data.unread,
        // "labels": protectNull(data.labels),
        // "sync_category": data.sync_category,
    }
    // console.info('message: ' + JSON.stringify(message));

    await createRecord(message);
}

const createRecord = async (record) => {    
    const { data, error } = await supabase.from('nylas_messages').insert([
        {
            "bcc": record.bcc,
            "cc": record.cc,
            "date": record.date,
            "from": record.from,
            "grant_id": record.grant_id,
            "message_id": record.message_id,
            "reply_to": record.reply_to,
            "to": record.to,
        }
    ]);

    if (error) {
        console.info(error);
    } else {
        console.info('message stored in supabase: ' + JSON.stringify(data));
    }
}

const protectNull = async (obj, emptyValue) => {
    if (!obj || obj == 'null') {
        return emptyValue;
    } else {
        return obj;
    }
}

const epochToDateTimeZone = async (epoch) => {
    return new Date(epoch * 1000).toISOString()
}

exports.snsNylasMessageHandler = async (event, context) => {
    for (record of event.Records) {
        const snsRecord = record.Sns;
        const snsMessage = JSON.parse(snsRecord.Message);

        switch (snsRecord.MessageAttributes.type.Value) {
            case 'com.nylas.messages.create.inflated':
                await handleEmail(snsMessage);
                break;
            default:
                break;
        }
    }
}
