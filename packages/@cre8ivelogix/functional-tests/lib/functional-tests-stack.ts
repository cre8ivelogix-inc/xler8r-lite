import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {X8Website} from '@cre8ivelogix/xler8r-lite/lib/x8-website'

export interface FunctionalTestsStackProps extends cdk.StackProps {
  /**
   * This property is required to create X8Website.
   */
    readonly domainName: string
}

export class FunctionalTestsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FunctionalTestsStackProps) {
    super(scope, id, props);

    new X8Website(this, "TestWebSite", {
      waDomainName: props.domainName,
      waSiteSubDomain: `ft-${Math.random().toString(36).slice(2, 7)}`,
    });
  }
}
