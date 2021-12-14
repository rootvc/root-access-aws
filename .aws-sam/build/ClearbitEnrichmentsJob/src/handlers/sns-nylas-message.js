var AWS = require('aws-sdk'),
    region = 'us-east-1',
    secretName = 'root_access/supabase_credentials'
;
const {createClient} = require('@supabase/supabase-js');
const aws = new AWS.SecretsManager({region: region});
let supabase = {};

function getAwsSecret(secretName) {
  return aws.getSecretValue({ SecretId: secretName }, (err, data) => {
    if (err) { throw err; }
    return data;
  }).promise();
}
async function getAwsSecretAsync (secretName) { return await getAwsSecret(secretName); }

const handleEmail = async (snsMessage) => {
    let data = {};
    for (let index in Object.keys(snsMessage.data)) {
        const key = Object.keys(snsMessage.data)[index];
        // console.info('(' + index + ') ' + key + ': ' +snsMessage.data[key]);
        data[key] = snsMessage.data[key];
    }

    // commented out fields are valid, but not used
    const message = {
        "bcc": getEmailField(data.bcc),
        // "body": data.body,
        "cc": getEmailField(data.cc),
        "date": epochToDateTimeZone(data.date),
        // "folder": data.folder,
        "from": getEmailField(data.from),
        "grant_id": data.grant_id,
        "id": data.id,
        // "object": data.object,
        "reply_to": protectNull(data.reply_to),
        // "snippet": data.snippet,
        // "starred": data.starred,
        // "subject": data.subject,
        "to": getEmailField(data.to),
        // "unread": data.unread,
        // "labels": protectNull(data.labels),
        // "sync_category": data.sync_category,

        "bcc_array": arrayFromEmailField(data.bcc),
        "cc_array": arrayFromEmailField(data.cc),
        "to_array": arrayFromEmailField(data.to),
        "from_array": arrayFromEmailField(data.from),
        "reply_to_array": arrayFromEmailField(data.reply_to),

        "updated_at": (new Date).toISOString(),
    }
    // console.info('message: ' + JSON.stringify(message));
    await Promise.all([createMessageRecord(message), createParticipantRecords(message)]);
}

const createMessageRecord = async (record) => {   
    const { data, error } = await supabase.from(`${process.env.TABLE_PREFIX}nylas_messages`)
        .upsert(record, { onConflict: 'id' });

    if (error) {
        console.error(error);
    } else {
        console.info(`Nylas message ${record.id} stored in database`);
    }
}

const createParticipantRecords = async (record) => {   
    const { data, error } = await supabase.from(`${process.env.TABLE_PREFIX}nylas_participants`)
        .upsert([
            {
                "message_id": record.id,
                "type": 'to',
                "grant_id": record.grant_id,
                "email": record.to,
                "email_array": record.to_array.concat(record.bcc_array, record.cc_array, record.reply_to_array),
                "updated_at": (new Date).toISOString(),
            }, {
                "message_id": record.id,
                "type": 'from',
                "grant_id": record.grant_id,
                "email": record.from,
                "email_array": record.from_array,
                "updated_at": (new Date).toISOString(),
            }
        ], { onConflict: 'message_id,type' }
        );

    if (error) {
        console.error(error);
    } else {
        console.info(`Nylas participant ${record.id} stored in database`);
    }
}

const protectNull = (obj, emptyValue) => {
    if (!obj || obj == 'null') {
        return emptyValue;
    } else {
        return obj;
    }
}

const getEmailField = (obj) => {
    let value;
    if (protectNull(obj)) {
        value = (obj.Email || obj[0].Email).toLowerCase();
    }
    return value;
}

const epochToDateTimeZone = (epoch) => {
    return new Date(epoch * 1000).toISOString()
}

const arrayFromEmailField = (field) => {
    const cleanField = getEmailField(field) || '';
    const regex = /([a-z0-9._+-]+@[a-z0-9_-]+[a-z]\.[a-z]+)+/g;
    return [... new Set(cleanField.match(regex))]; // unique
}

exports.snsNylasMessageHandler = async (event, context) => {
    const awsSecret = await getAwsSecretAsync(secretName);
    const secret = JSON.parse(awsSecret.SecretString);
    supabase = createClient(secret.SUPABASE_URL, secret.SUPABASE_TOKEN);

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
