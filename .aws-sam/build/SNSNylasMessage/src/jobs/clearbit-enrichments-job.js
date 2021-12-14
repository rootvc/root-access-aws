const CLEARBIT_LIMIT = 10; // maximimum number of Clearbit enrichments to process at once

var AWS = require('aws-sdk'),
    region = 'us-east-1',
    supabaseSecretName = 'root_access/supabase_credentials',
    clearbitSecretName = 'root_access/clearbit_credentials'
;

const {createClient} = require('@supabase/supabase-js');
let supabase = {};

var clearbitClient = require('clearbit').Client;
let clearbit = {};

const aws = new AWS.SecretsManager({region: region});
function getAwsSecret(secretName) {
  return aws.getSecretValue({ SecretId: secretName }, (err, data) => {
    if (err) {
        console.error(err); throw(err);
    }
    return data;
  }).promise();
}

const getContactsRecords = async () => {
    const { data, error } = await supabase.from(`${process.env.TABLE_PREFIX}contacts`)
        .select('email');
    
    if (error) {
        console.error(error);
    } else {
        return data;
    }
}

const getClearbitEnrichmentsRecords = async () => {
    const { data, error } = await supabase.from(`${process.env.TABLE_PREFIX}clearbit_enrichments`)
        .select('email');

    if (error) {
        console.error(error);
    } else {
        return data;
    }
}

const upsertClearbitEnrichmentRecords = async (emails, values) => {
    const upsertData = values.map((entry, i) => {
        const email = emails[i];
        const record = entry;
        const recordIsEmpty = Object.keys(record).length == 0;

        if (recordIsEmpty) {
            console.info(`No enrichment data found for ${email}`);
        } else {
            console.info(`Enrichment data found for ${email}`);
        }
        
        let obj = new Object({
            "email": email,
            "raw_response": recordIsEmpty ? null : record,
            "person_id": null,
            "person_name_family_name": null,
            "person_name_given_name": null,
            "person_indexed_at": null,
            "company_id": null,
            "company_domain": null,
            "company_name": null,
            "company_indexed_at": null,
            "created_at": (new Date).toISOString(), // TODO: make null
            "updated_at": (new Date).toISOString()
        });

        if (record.person != null) {
            obj.person_id = record.person.id;
            obj.person_name_family_name = record.person.name.familyName;
            obj.person_name_given_name = record.person.name.givenName;
            obj.person_indexed_at = record.person.indexedAt;
        };

        if (record.company != null) {
            obj.company_id = record.company.id;
            obj.company_domain = record.company.domain;
            obj.company_name = record.company.name;
            obj.company_indexed_at = record.company.indexedAt;
        };
        
        return obj;
    
    });

    const { data, error } = await supabase.from(`${process.env.TABLE_PREFIX}clearbit_enrichments`)
        .upsert(upsertData, { onConflict: 'email' });
    if (error) {
        console.error(error);
    } else {
        console.info(`${data.length} records upserted`);
        return data;
    }
}

exports.clearbitEnrichmentsJob = () => {
    const response = Promise.all([getAwsSecret(clearbitSecretName), getAwsSecret(supabaseSecretName)])
    .then(responses => {
        const clearbitSecret = JSON.parse(responses[0].SecretString);
        const supabaseSecret = JSON.parse(responses[1].SecretString);

        supabase = createClient(supabaseSecret.SUPABASE_URL, supabaseSecret.SUPABASE_TOKEN);
        clearbit = new clearbitClient({key: clearbitSecret.CLEARBIT_API_KEY});

        return Promise.all([getContactsRecords(), getClearbitEnrichmentsRecords()]);
    }).then(promises => {
        const [contacts, clearbitEnrichments] = promises;
        const emailsToEnrich = contacts
        .map(o => o.email)
        .map(email => email.toLowerCase().replace(/\+[^)]*@/, '@'))
        .filter(email =>
            !clearbitEnrichments.find(clearbitEnrichment =>
                clearbitEnrichment.email === email)
        )
        .slice(0, CLEARBIT_LIMIT);
        return emailsToEnrich;
    }).then(emails => {
        const promises = emails.map(email => {
            return clearbit.Enrichment.find({ email: email, stream: true })
            .then(record => {
                return record;
              })
              .catch(function (err) {
                console.error(err);
                return {};
              });
        });
        return Promise.all([emails, Promise.all(promises)]);
    })
    .then(function (records) {
        const [emails, responses] = records;
        return upsertClearbitEnrichmentRecords(emails, responses);
    })
    .catch(function(err) {
        console.error(err);
        throw err;
    });

    return response;
}
