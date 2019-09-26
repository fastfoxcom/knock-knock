# knock-knock
> knock-knock is a slack bot for phabricator

## Table of contents
* [General info](#general-info)
* [Screenshots](#screenshots)
* [Technologies](#technologies)
* [Setup](#setup)
* [Features](#features)
* [Status](#status)
* [Inspiration](#inspiration)

## General info
> knock-knock is for teams using phabricator as a code repository, code review tool and slack as the istant messaging app for intra team communication. It is a productivity tool that enables teams to reduce code review turn around times by reminding them about pending revisions in a slack channel and as a private message via slackbot

## Screenshots
![Example screenshot](./img/knock-knock-message.png)

## Technologies
* [Node.js](https://nodejs.org)
* [@slack/webhook](https://slack.dev/node-slack-sdk/webhook)

## Setup
* Clone the repository
* Get a [slack webhook](https://slack.com/intl/en-in/help/articles/115005265063-incoming-webhooks-for-slack) and a [phabricator conduit](https://secure.phabricator.com/book/phabricator/article/conduit/) token
* Setup the .env file
* Setup the configuration file
* Setup ./src/app.js as a service (node express api server)
* Setup a crontab to periodically hit the APIs for required features or integrate the same with any of your workflows

## Features
List of features ready and TODOs for future development
* Send Differential reminders via a simple GET request to /v1/sendPhabDifferentialReminder
    * A message will be sent (the one in the screenshot) to the configured slack channel
    * A filtered message (based on "waiting on" developer) will also be sent via slackbot
    * Message Format:
        ```
        [androidApp#D13073] Updates in chat library (Rahul Bansal)
        14 days stale ·  22 days old · Waiting on - [✗] @Khushbu Mishra, [.] @Abhilash Chikara
        ```
        ```
        [<Repository Name>#<Differential ID>] <Differential title> (Differential Author)
        <Number of days since last update>  ·  <Number of days since creation> ·  Waiting on - <Symbol for review Status> <Slack Mention String>
        ```


To-do list:
* Send personal slack messages on phabricator events like:
    * Differential rejected
    * Differential accpeted
    * Requested review on a differential
* Use a dedicated slack bot instead of the common slackbot
* Solve for pagination while fetching active differentials. Currently, only top 100 differentials are reported

## Status
Project is _in progress_ as some of the features are yet to be coded for. Having said that, the list of features not in to-do list are fully functional

## Inspiration
[Pull Reminders](https://pullreminders.com/) app for github PRs
