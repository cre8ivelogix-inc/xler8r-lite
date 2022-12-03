import {WaBucket, WaBucketProps} from "@cre8ivelogix/wa-cdk-lite";
import {Construct} from "constructs";
import {CfnOutput, Duration} from "aws-cdk-lib";
import {Distribution} from "aws-cdk-lib/aws-cloudfront";
import {DnsValidatedCertificate} from "aws-cdk-lib/aws-certificatemanager";
import { pascalCase } from "pascal-case";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudfront_origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

/**
 * X8WebSiteProps can be used to configure several behaviors of the hosted website
 */
export interface X8WebSiteProps {
    /**
     * This property is used to provide the domain name where the website will be hosted
     */
    readonly waDomainName: string;
    /**
     * This property is used to provide the subdomain name where the website will be hosted.
     * @default www
     */
    readonly waSiteSubDomain?: string;
    /**
     * This property is used to provide the site content.
     * @default build
     */
    readonly waPathToContent?: string;
    /**
     * This property is used to provide custom root object for the cloudfront distribution.
     * @default index.html
     */
    readonly waDefaultRootObject?: string;
    /**
     * This property is used to provide custom error page for the cloudfront distribution. Path must begin with /
     * @default /error.html
     */
    readonly waErrorResponsePagePath?: string;
    /**
     * This property is used to provide any additional bucket policies actions.
     * @default s3:GetObject
     */
    readonly waBucketPolicyActions?: string[];
    /**
     * This property is used to override existing or provide additional properties for bucket configuration.
     */
    readonly waBucketProps?: WaBucketProps;
    /**
     * This property is used to provide existing origin access identity instead of creating a new one.
     */
    readonly waOriginAccessIdentity?: cloudfront.OriginAccessIdentity;
    /**
     * This property is used to disable or enable cloudfront logging.
     * @default false
     */
    readonly waEnableCloudFrontLogging?: boolean;
    /**
     * This property is used to override the cloudfront distribution behavior.
     */
    readonly waCloudFrontDistributionDefaultBehavior?: cloudfront.BehaviorOptions;
}

/**
 * X8Website can be used to build a well architected website hosted in S3 Bucket and with cloudfront as entry point.
 * This construct assumes that there is a hosted zone configured correctly in Route53 for the provided domain name.
 */
export class X8Website extends Construct {
    readonly cdn: Distribution;
    readonly websiteBucket: WaBucket;
    readonly cloudfrontOAI: cloudfront.OriginAccessIdentity;

    constructor(scope: Construct, name: string, props: X8WebSiteProps) {
        super(scope, name);

        const domainNameId = X8Website.domainNameToPascalCase(props.waDomainName);

        const zone = route53.HostedZone.fromLookup(this, `${domainNameId}Zone`, {
            domainName: props.waDomainName
        });

        const subDomain = props.waSiteSubDomain ?? "www"
        const siteDomain = `${subDomain}.${props.waDomainName}`;

        this.cloudfrontOAI = props.waOriginAccessIdentity ?? new cloudfront.OriginAccessIdentity(
            this,
            "OriginAccessIdentity",
            {
                comment: `OAI for ${name}`
            }
        );

        this.websiteBucket = new WaBucket(this, "WebsiteBucket", {
            ...props.waBucketProps,
            bucketName: siteDomain
        });

        const bucketPolicyActions = props.waBucketPolicyActions ?? []
        bucketPolicyActions.push("s3:GetObject")

        // Grant access to cloudfront OAI
        this.websiteBucket.addToResourcePolicy(
            new iam.PolicyStatement({
                actions: bucketPolicyActions,
                resources: [this.websiteBucket.arnForObjects("*")],
                principals: [
                    new iam.CanonicalUserPrincipal(
                        this.cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
                    )
                ]
            })
        );

        const certificate = new DnsValidatedCertificate(
            this,
            `${domainNameId}Cert`,
            {
                domainName: siteDomain,
                hostedZone: zone
            }
        );

        this.cdn = new Distribution(
            this,
            `${domainNameId}Distribution`,
            {
                certificate: certificate,
                enableLogging: props.waEnableCloudFrontLogging ?? false,
                defaultRootObject: props.waDefaultRootObject ?? "index.html",
                domainNames: [siteDomain],
                errorResponses: [
                    {
                        httpStatus: 403,
                        responseHttpStatus: 403,
                        responsePagePath: props.waErrorResponsePagePath ?? "/error.html",
                        ttl: Duration.minutes(30)
                    }
                ],
                defaultBehavior: {
                    ...props.waCloudFrontDistributionDefaultBehavior,
                    origin: new cloudfront_origins.S3Origin(this.websiteBucket, {
                        originAccessIdentity: this.cloudfrontOAI
                    }),
                    compress: true,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS
                }
            }
        );

        new route53.ARecord(this, `${domainNameId}AliasRecord`, {
            recordName: siteDomain,
            target: route53.RecordTarget.fromAlias(
                new targets.CloudFrontTarget(this.cdn)
            ),
            zone
        });

        new s3deploy.BucketDeployment(this, "DeployWithInvalidation", {
            sources: [s3deploy.Source.asset(props.waPathToContent ?? "build")],
            destinationBucket: this.websiteBucket,
            distribution: this.cdn,
            distributionPaths: ["/*"]
        });

        new CfnOutput(this, "Bucket", { value: this.websiteBucket.bucketName });
        new CfnOutput(this, "Certificate", { value: certificate.certificateArn });
        new CfnOutput(this, "DistributionId", {value: this.cdn.distributionId});
        new CfnOutput(this, "WebsiteUrl", { value: "https://" + siteDomain });
    }

    public static domainNameToPascalCase(domainName: string): string {
        const domainParts: string[] = domainName.split(".");
        let domain: string = "";
        for (let domainPart of domainParts) {
            domain += pascalCase(domainPart);
            domain += "Dot";
        }
        return domain.replace("-", "")
            .slice(0, domain.lastIndexOf("Dot"));
    }
}
