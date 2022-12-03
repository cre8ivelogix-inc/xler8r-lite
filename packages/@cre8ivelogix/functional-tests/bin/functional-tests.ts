#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FunctionalTestsStack } from '../lib/functional-tests-stack';

const app = new cdk.App();

console.log("Executing Functional Tests...");

const domain = process.env.DOMAIN || ""

new FunctionalTestsStack(app, 'FunctionalTestsStack', {
    env: {
        account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
    },
    domainName: domain
});