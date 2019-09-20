const config = require('config');
const moment = require('moment');

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
    baseURL: config.get('serviceUrls.phabricator'),
    params: {
      "api.token": process.env.PHABRICATOR_CONDUIT_TOKEN,
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
  let diffReviewers = reviewers.map((reviewer) => {
    return {
      slackMentionString: getSlackMentionString({phID: reviewer.reviewerPHID}),
      name: config.has(`developers.${reviewer.reviewerPHID}.name`) ? config.get(`developers.${reviewer.reviewerPHID}.name`) : 'Unknown',
      status: reviewer.status
    }
  });
  let diffReviewersSlackUserNames = reviewers.map((reviewer) => {
    return config.has(`developers.${reviewer.reviewerPHID}.slackUserName`) ? config.get(`developers.${reviewer.reviewerPHID}.slackUserName`) : `Unknown`;
  });
  return {diffReviewers, diffReviewersSlackUserNames};
}

const getSlackMentionString = ({phID}) => {
  return config.has(`developers.${phID}.slackId`) ?
  `<@${config.get(`developers.${phID}.slackId`)}|${config.get(`developers.${phID}.slackUserName`)}>` : 'Unknown';
}

const getActiveDifferentialsData = async ({activeDifferentials}) => {
  let repositoryPHIDs = new Set([]);
  let activeDifferentialsData = [];
  let diffInvolvedDevelopers = [];
  activeDifferentials.forEach(activeDifferential => {
    if (activeDifferential['repositoryPHID']) {
      repositoryPHIDs.add(activeDifferential['repositoryPHID']);
    }
  });
  let repositoryPHIDMap = await getRepositoryPHIDMap({repositoryPHIDs: [...repositoryPHIDs]})
  activeDifferentials.forEach(activeDifferential => {
    const diffAuthorSlackId = config.has(`developers.${activeDifferential.fields.authorPHID}.slackUserName`) ?  config.get(`developers.${activeDifferential.fields.authorPHID}.slackUserName`) : `Unknown`;
    const {diffReviewers, diffReviewersSlackUserNames} = getFormattedReviewers({reviewers: activeDifferential.attachments.reviewers.reviewers})
    const thisDiffInvolvedDevelopers = [...new Set([diffAuthorSlackId ,...diffReviewersSlackUserNames])];
    activeDifferentialsData.push({
      diffId: activeDifferential.id,
      diffTitle: activeDifferential.fields.title,
      diffAuthorSlackUserName: diffAuthorSlackId,
      diffAuthorSlackMentionString: getSlackMentionString({phID: activeDifferential.fields.authorPHID}),
      diffAuthorName: config.has(`developers.${activeDifferential.fields.authorPHID}.name`) ? config.get(`developers.${activeDifferential.fields.authorPHID}.name`) : `Unknown`,
      diffStatus: activeDifferential.fields.status.value,
      diffCreated: activeDifferential.fields.dateCreated,
      diffModified: activeDifferential.fields.dateModified,
      diffReviewers: diffReviewers,
      diffRepository: repositoryPHIDMap[activeDifferential.fields.repositoryPHID],
      diffInvolvedDevelopers: thisDiffInvolvedDevelopers
    });
    diffInvolvedDevelopers = [...thisDiffInvolvedDevelopers, ...diffInvolvedDevelopers];
  });
  return {activeDifferentialsData, diffInvolvedDevelopers};
}

const getFormattedMessageForSlack = ({activeDifferentialsData}) => {
  /*
  Requiured keys to Format:
  repositoryName
  diffId
  diffTitle
  diffStatus
  diffAuthorSlackId
  diffAuthorName
  diffReviewers []
  diffCreatedAt
  diffModifiedAt
  diffRepository

  [icrmapp#1560] DCF for HL sales (aravindjayanthi)
  4 days stale · 5 days old · Waiting on @Ishan Khanna, @Anupam Dixit

  Slack Link format: <https://alert-system.com/alerts/1234|Click here>

  */

  // Ordering by Modified At
  activeDifferentialsData.sort((a, b) => (a.diffModified > b.diffModified) ? -1 : 1)

  // Groouping by review status
  let formattedMessages = {};
  formattedMessages[process.env.SLACK_CHANNEL] = {
    "needs-review": [],
    "needs-revision": []
  };
  activeDifferentialsData.forEach(activeDifferential => {
    if (activeDifferential.diffStatus == "needs-review") {
      formattedMessages[process.env.SLACK_CHANNEL]["needs-review"].push(activeDifferential);
    } else if(activeDifferential.diffStatus == "needs-revision") {
      formattedMessages[process.env.SLACK_CHANNEL]["needs-revision"].push(activeDifferential);
    }
  });
  Object.keys(formattedMessages).forEach(channel => {
    let formattedText = ``;
    if (formattedMessages[channel][`needs-revision`] && formattedMessages[channel][`needs-revision`].length) {
      formattedText = `*Needs Revision*\n\n`;
      formattedMessages[channel][`needs-revision`].forEach(activeDifferential => {
        formattedText += `${getFormattedDiffMessage({activeDifferential})}\n\n`;
      });
    }
    if (formattedMessages[channel][`needs-review`] && formattedMessages[channel][`needs-review`].length) {
      formattedText += `*Needs Review*\n\n`;
      formattedMessages[channel][`needs-review`].forEach(activeDifferential => {
        formattedText += `${getFormattedDiffMessage({activeDifferential})}\n\n`;
      });
    }
    formattedMessages[channel][`formattedMessageText`] = formattedText;
  });

  let activeDifferentialsPerUser = {};
  [`needs-review`, `needs-revision`].forEach(reviwStatus => {
    formattedMessages[process.env.SLACK_CHANNEL][reviwStatus].forEach(activeDifferential => {
      activeDifferential.diffInvolvedDevelopers.forEach(developerSlackUserName => {
        if (developerSlackUserName in activeDifferentialsPerUser) {
          activeDifferentialsPerUser[developerSlackUserName].push(activeDifferential);
        } else {
          activeDifferentialsPerUser[developerSlackUserName] = [activeDifferential];
        }
      });
    });
  });

  let formattedMessagesPerUser = {};
  Object.keys(activeDifferentialsPerUser).forEach(slackUserName => {
    formattedMessagesPerUser[slackUserName] = getFormattedMessageForChannel({activeDifferentials: activeDifferentialsPerUser[slackUserName]})
  })

  let formattedMessageForMainChannel = {}
  formattedMessageForMainChannel[process.env.SLACK_CHANNEL] = formattedMessages[process.env.SLACK_CHANNEL][`formattedMessageText`];

  return Object.assign({}, formattedMessageForMainChannel, formattedMessagesPerUser);
}

const getFormattedMessageForChannel = ({activeDifferentials}) => {
  let activeDifferentialsNeedsReview = [];
  let activeDifferentialsNeedsRevision = [];

  activeDifferentials.forEach(activeDifferential => {
    if (activeDifferential.diffStatus == "needs-review") {
      activeDifferentialsNeedsReview.push(activeDifferential);
    } else if(activeDifferential.diffStatus == "needs-revision") {
      activeDifferentialsNeedsRevision.push(activeDifferential);
    }
  });
  let formattedText = ``;
  if (activeDifferentialsNeedsRevision.length) {
    formattedText = `*Needs Revision*\n\n`;
    activeDifferentialsNeedsRevision.forEach(activeDifferential => {
      formattedText += `${getFormattedDiffMessage({activeDifferential})}\n\n`;
    });
  }
  if (activeDifferentialsNeedsReview.length) {
    formattedText += `*Needs Review*\n\n`;
    activeDifferentialsNeedsReview.forEach(activeDifferential => {
      formattedText += `${getFormattedDiffMessage({activeDifferential})}\n\n`;
    });
  }
  return formattedText;
}

const getActiveReviewersSlackId  = ({reviewers}) => {
  return reviewers.map((reviewer) => {
    if (reviewer.status != 'resigned') {
      return reviewer.slackId;
    }
  });
}

const getFormattedDiffMessage = ({activeDifferential}) => {
  const timeStampsInfo = `${moment.unix(activeDifferential.diffModified).fromNow(true)} stale ·  ${moment.unix(activeDifferential.diffCreated).fromNow(true)} old`;
  const reviewStatusIconMap = {
    'blocking': `[!]`,
    'added': `[.]`,
    'accepted': `[✓]`,
    'rejected': `[✗]`,
    'commented': `[✎]`,
    'accepted-older': `~[✓]~`,
    'rejected-older': `~[✗]~`,
    'resigned': `~[.]~`
  };
  let waitingOnInfo = `${activeDifferential.diffReviewers && activeDifferential.diffReviewers.length ? activeDifferential.diffReviewers.map((item) => {return `${item.status in reviewStatusIconMap? reviewStatusIconMap[item.status] : '[?]'} ${item.slackMentionString}`;}).join(`, `) : `${activeDifferential.diffAuthorSlackId} to assign a reviewer`}`;

  if (activeDifferential.diffStatus == `needs-revision`) {
    waitingOnInfo = `${activeDifferential.diffAuthorSlackId} · Review Status - ${waitingOnInfo}`
  }

  return `[${activeDifferential.diffRepository}#D${activeDifferential.diffId}] <${config.get('serviceUrls.phabricator')}D${activeDifferential.diffId}|${activeDifferential.diffTitle}> (${activeDifferential.diffAuthorName})\n${timeStampsInfo} · Waiting on - ${waitingOnInfo}`;
}

const getActiveDifferentials = async () => {
  /*
  Examples
  curl https://phabricator.broex.net/api/differential.revision.search \
  -d api.token=xxxxxxxxxxxxxxx \
  -d constraints[statuses][0]=needs-review \
  -d constraints[statuses][1]=needs-revision \
  -d attachments[reviewers]=1
  */
  let reqObj = {
    url: 'api/differential.revision.search',
    baseURL: config.get('serviceUrls.phabricator'),
    params: {
      "api.token": process.env.PHABRICATOR_CONDUIT_TOKEN,
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
    if (activeDifferentials && activeDifferentials.data && activeDifferentials.data.length) {
      const {activeDifferentialsData, diffInvolvedDevelopers} = await getActiveDifferentialsData({activeDifferentials: activeDifferentials.data});
      const messagesToBeSent = getFormattedMessageForSlack({activeDifferentialsData, diffInvolvedDevelopers});
      // Doing this synchronously because it doesn't matter, will solve if required
      Object.keys(messagesToBeSent).forEach(messageObject => {
        if (messageObject.indexOf('known') == -1) {
          sendSlackMessage({
            messageTo: messageObject == process.env.SLACK_CHANNEL ? messageObject : `@${messageObject}`,
            messageText: messagesToBeSent[messageObject]
          });
        }
      });
    } else {
      sendSlackMessage({
        messageTo: process.env.SLACK_CHANNEL,
        messageText: `@channel, Hurray! you have No active diffs under review! Wait, what?`
      });
    }
    return "Ok";
  }
}
