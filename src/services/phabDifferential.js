const config = require('config');

const { post } = require('src/utils/api/request');
const { sendSlackMessage } = require('src/services/slack');

const getRepositoryPHIDMap = async ({repositoryPHIDs}) => {
  /*
  $ curl https://phabricator.broex.net/api/differential.repository.search \
    -d api.token=api-token \
    -d constraints[phids][0]=PHID-REPO-tzgid3l6wliwceg2otzm
  */
  let reqObj = {
    url: 'api/diffusion.repository.search',
    baseURL: config.get('microServiceUrls.phabricator'),
    params: {
      "api.token": "cli-gxuj3u7geydvv7uosdt7ilzaysm5",
    },
  };
  repositoryPHIDs.forEach((repositoryPHID, index) => {
    params[`constraints[phids][${index}]`] = repositoryPHID;
  });
  const { data: { result: { data: repositoryObjects} }} = await post(reqObj);
  const repositoryPHIDMap = {};
  repositoryObjects.forEach(repositoryObject => {
    repositoryPHIDMap[repositoryObject['phid']] = repositoryObject['fields']['name'];
  });
  return repositoryPHIDMap;
}

const getFormattedReviewers = ({reviewers}) => {
  return reviewers.map((reviewer)=>{
    return {
      name: config.has(`developers.${reviewer.reviewerPHID}.slackId`) ? config.get(`developers.${reviewer.reviewerPHID}.slackId`) : 'Unknown',
      status: reviewer.status
    }
  });
}

const getActiveDifferentialsData = async ({activeDifferentials}) => {
  let repositoryPHIDs = new Set([]);
  let activeDifferentialsData = [];
  activeDifferentials.forEach(activeDifferential => {
    if (activeDifferential['repositoryPHID']) {
      repositoryPHIDs.add(activeDifferential['repositoryPHID']);
    }
  });
  let repositoryPHIDMap = await getRepositoryPHIDMap({repositoryPHIDs: [...repositoryPHIDs]})
  activeDifferentials.forEach(activeDifferential => {
    activeDifferentialsData.push({
      diffId: activeDifferential.id,
      diffTitle: activeDifferential.fields.title,
      diffAuthor: config.has(`developers.${activeDifferential.fields.authorPHID}.slackId`) ? config.get(`developers.${activeDifferential.fields.authorPHID}.slackId`) : 'Unknown',
      diffStatus: activeDifferential.fields.status.value,
      diffCreated: activeDifferential.fields.dateCreated,
      diffModified: activeDifferential.fields.dateModified,
      diffReviewers: getFormattedReviewers({reviewers: activeDifferential.attachments.reviewers.reviewers}),
      diffRepository: repositoryPHIDMap[activeDifferential.fields.repositoryPHID]
    });
  });
  return activeDifferentialsData;
}

const getFormattedMessageForSlack = ({activeDifferentialsData}) => {
  /*
  Requiured keys to Format:
  repositoryName
  diffId
  diffTitle
  diffStatus
  diffAuthor
  diffReviewers []
  diffCreatedAt
  diffModifiedAt
  diffRepository

  [icrmapp#1560] DCF for HL sales (aravindjayanthi)
  4 days stale · 5 days old · Waiting on @Ishan Khanna, @Anupam Dixit

    {
      "diffId": 13095,
      "diffTitle": "fixed issue BROEXCON-108, BROEXCON-113, BROEXCON-107, BROEXCON-111, BROEXCON-109, BROEXCON-110, BROEXCON-115, BROEXCON-114",
      "diffAuthor": "Unknown",
      "diffStatus": "needs-review",
      "diffCreated": 1568725403,
      "diffModified": 1568727029,
      "diffReviewers": [
        {
          "name": "Unknown",
          "status": "added"
        }
      ],
      "diffRepository": "Sahadeva"
    }
  */
  // Slack Link format: <https://alert-system.com/alerts/1234|Click here>
  /*
  TO DO:
  1. Ordering
  2. Grouping by review status
  3. Stale and created at info display
  4. Reviewer Status
  5. Filter on modified at (atleast one day old)
  6. Populate configuration with other people's name
  7. Chanelise the messages in apt channel
  8. Start working on events and scheduled personal messages
  */
  console.log(activeDifferentialsData);

  // Ordering by Modified At
  activeDifferentialsData.sort((a, b) => (a.diffModified > b.diffModified) ? -1 : 1)
  
  // Groouping by review status
  let needsReviewDifferentials = [];
  let needsRevisionDifferentials = [];
  activeDifferentialsData.forEach(activeDifferential => {
    if (activeDifferential.diffStatus = "needs-review") {
      needsReviewDifferentials.push(activeDifferential); 
    } else if(activeDifferential.diffStatus = "needs-revision") {
      needsRevisionDifferentials.push(activeDifferential);
    }
  });

  let formattedText = `*Needs Revision*\n\n`;
  needsRevisionDifferentials.forEach(activeDifferential => {
    formattedText += `${getFormattedDiffMessage({activeDifferential})}\n\n`; 
  });
  formattedText += `*Needs Review*\n\n`;
  needsReviewDifferentials.forEach(activeDifferential => {
    formattedText += `${getFormattedDiffMessage({activeDifferential})}\n\n`; 
  });
  return formattedText
}

const getFormattedDiffMessage = ({activeDifferential}) => {
  return `[${activeDifferential.diffRepository}#D${activeDifferential.diffId}] <${config.get('microServiceUrls.phabricator')}D${activeDifferential.diffId}|${activeDifferential.diffTitle}> (${activeDifferential.diffAuthor})\nWaiting on ${activeDifferential.diffReviewers && activeDifferential.diffReviewers.length ?activeDifferential.diffReviewers.map((item) => {return item.name;}).join(`, `) : `${activeDifferential.diffAuthor} to assign a reviewer`}`;
}

const getActiveDifferentials = async () => {
  /*
  Examples
  curl https://phabricator.broex.net/api/differential.revision.search \
  -d api.token=cli-gxuj3u7geydvv7uosdt7ilzaysm5 \
  -d constraints[statuses][0]=needs-review \
  -d constraints[statuses][1]=needs-revision \
  -d attachments[reviewers]=1
  */
  let reqObj = {
    url: 'api/differential.revision.search',
    baseURL: config.get('microServiceUrls.phabricator'),
    params: {
      "api.token": "cli-gxuj3u7geydvv7uosdt7ilzaysm5",
      "constraints[statuses][0]": "needs-review",
      "constraints[statuses][1]": "needs-revision",
      "attachments[reviewers]":1
    },
  };
  const { data: { result: response } } = await post(reqObj);
  return response;
};

module.exports = {
  sendPhabDifferentialReminder: async () => {
    const activeDifferentials = await getActiveDifferentials();
    // TODO:mohit Ignoring pagination for now
    const activeDifferentialsData = await getActiveDifferentialsData({activeDifferentials: activeDifferentials.data});
    const messageText = getFormattedMessageForSlack({activeDifferentialsData});
    sendSlackMessage({messageText});
    return "Ok";
  }
}
