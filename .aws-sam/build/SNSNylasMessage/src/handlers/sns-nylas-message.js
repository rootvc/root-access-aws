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
        "bcc": cleanEmailAddresses(data.bcc),
        // "body": data.body,
        "cc": cleanEmailAddresses(data.cc),
        "date": epochToDateTimeZone(data.date),
        // "folder": data.folder,
        "from": cleanEmailAddresses(data.from),
        "grant_id": data.grant_id,
        "id": data.id,
        // "object": data.object,
        "reply_to": protectNull(data.reply_to),
        // "snippet": data.snippet,
        // "starred": data.starred,
        // "subject": data.subject,
        "to": cleanEmailAddresses(data.to),
        // "unread": data.unread,
        // "labels": protectNull(data.labels),
        // "sync_category": data.sync_category,
        "updated_at": (new Date).toISOString(),
    }
    // console.info('message: ' + JSON.stringify(message));

    await createRecord(message);
}

const createRecord = async (record) => {   
    const { data, error } = await supabase.from('nylas_messages')
        .upsert(record, { onConflict: 'id' });

    if (error) {
        console.error(error);
    } else {
        console.info(`Nylas message ${record.id} stored in supabase: ${JSON.stringify(data)}`);
    }
}

const protectNull = (obj, emptyValue) => {
    if (!obj || obj == 'null') {
        return emptyValue;
    } else {
        return obj;
    }
}

const cleanEmailAddresses = (obj) => {
    if (protectNull(obj)) {
        return obj.Email || obj[0].Email;
    } else {
        return ''
    }
}

const epochToDateTimeZone = (epoch) => {
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
