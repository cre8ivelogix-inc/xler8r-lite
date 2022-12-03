#!/usr/bin/env bash
if [[ $# -ge 3 ]]; then
    export CDK_DEPLOY_ACCOUNT=$1
    export CDK_DEPLOY_REGION=$2
    export DOMAIN=$3
    shift; shift; shift
    npx cdk deploy --require-approval never "$@"
    exit $?
else
    echo 1>&3 "Provide account, region and domain as first three args in that order."
    echo 1>&3 "Additional args are passed through to cdk deploy."
    exit 1
fi