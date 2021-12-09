var AWS = require('aws-sdk'),
    region = 'us-east-1',
    secretName = 'root_access/supabase_credentials'
;
const {createClient} = require('@supabase/supabase-js');
const aws = new AWS.SecretsManager({region: region});
let supabase = {};
const env = process.env.ENVIRONMENT_PREFIX || '';

function getAwsSecret(secretName) {
  return aws.getSecretValue({ SecretId: secretName }, (err, data) => {
    if (err) { throw err; }
    return data;
  }).promise();
}

async function getAwsSecretAsync (secretName) {
    return await getAwsSecret(secretName);
}

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

    await Promise.all([createMessageRecord(message), createParticipantRecords(message)]);
}

const createMessageRecord = async (record) => {   
    const { data, error } = await supabase.from(`${env}nylas_messages`)
        .upsert(record, { onConflict: 'id' });

    if (error) {
        console.error(error);
    } else {
        console.info(`Nylas message ${record.id} stored in supabase: ${JSON.stringify(data)}`);
    }
}

const createParticipantRecords = async (record) => {   
    const { data, error } = await supabase.from(`${env}nylas_participants`)
        .upsert([
            {
                "message_id": record.id,
                "type": 'to',
                "grant_id": record.grant_id,
                "email": record.to,
                "updated_at": (new Date).toISOString(),
            }, {
                "message_id": record.id,
                "type": 'from',
                "grant_id": record.grant_id,
                "email": record.from,
                "updated_at": (new Date).toISOString(),
            }
        ], { onConflict: 'message_id,type' }
        );

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
