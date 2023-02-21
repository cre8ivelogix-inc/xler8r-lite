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
    readonly waSubDomain?: string;
    /**
     * This property is used to provide the site content.
     * @default build
     */
    readonly waPathToContent?: string;
    /**
     * Additional domain names to be included in ssl and redirect traffic to main domain
     */
    readonly waAdditionalDomainNames?: string[]
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
 * This construct can help build Well Architected infrastructure for website hosting in AWS using S3 Bucket
 * It will create the following Well Architected resources using CRE8IVELOGIX
 * Well Architected CDK Lite as part of the infrastructure
 * 1. A validated public certificate for the website domain
 * 2. An S3 Bucket using Well Architected Bucket construct
 * 3. Creates and attaches the Bucket policies
 * 4. A CloudFront distribution for bucket origin
 * 7. A Route53 record to route traffic to CloudFront Distribution
 * 8. Deploys the website content to the bucket
 *
 * ### Default Alarms
 *
 * @example Default Usage
 * ```ts
 * new X8Website(this, "LogicalId", {
 *      waDomainName: 'cre8ivelogix.com',
 *      waSubdomain: "www",
 *      waPathToContent: './site-content'
 * });
 * ```
 *
 * @example Custom Configuration
 * ```ts
 * new X8Website(this, "LogicalId", {
 *      waDomainName: 'cre8ivelogix.com',
 *      waSubdomain: "www",
 *      waPathToContent: './site-content',
 *      waAdditionalDomainNames: ['www2.cre8ivelogix.com']
 * });
 * ```
 *
 * ### Compliance
 * It addresses the following compliance requirements
 * * Enable Origin Access Identity for Distributions with S3 Origin
 * * Use CloudFront Content Distribution Network
 * * Enable S3 Block Public Access for S3 Buckets
 * * Enable S3 Bucket Keys
 * * Secure Transport
 * * Server Side Encryption
 */
export class X8Website extends Construct {
    /**
     * CloudFront distribution used in this construct
     */
    readonly cdn: Distribution;
    /**
     * Bucket hosting website content
     */
    readonly websiteBucket: WaBucket;
    /**
     * Origin Access Identity
     */
    readonly cloudfrontOAI: cloudfront.OriginAccessIdentity;

    constructor(scope: Construct, name: string, props: X8WebSiteProps) {
        super(scope, name);

        const domainNameId = X8Website.domainNameToPascalCase(props.waDomainName);

        const zone = route53.HostedZone.fromLookup(this, `${domainNameId}Zone`, {
            domainName: props.waDomainName
        });

        const wwwSiteDomain = this.getSiteDomain(props)

        this.cloudfrontOAI = props.waOriginAccessIdentity ?? new cloudfront.OriginAccessIdentity(
            this,
            "OriginAccessIdentity",
            {
                comment: `OAI for ${name}`
            }
        );

        this.websiteBucket = new WaBucket(this, "WebsiteBucket", {
            ...props.waBucketProps,
            bucketName: wwwSiteDomain
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

        const certSans = this.getCertificateDomains(props);

        const certificate = new DnsValidatedCertificate(
            this,
            `${domainNameId}Cert`,
            {
                domainName: wwwSiteDomain,
                hostedZone: zone,
                subjectAlternativeNames: certSans
            }
        );

        const distributionDomainWithSans = this.getDistributionDomains(props)

        this.cdn = new Distribution(
            this,
            `${domainNameId}Distribution`,
            {
                certificate: certificate,
                enableLogging: props.waEnableCloudFrontLogging ?? false,
                defaultRootObject: props.waDefaultRootObject ?? "index.html",
                domainNames: distributionDomainWithSans,
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

        new s3deploy.BucketDeployment(this, "DeployWithInvalidation", {
            sources: [s3deploy.Source.asset(props.waPathToContent ?? "build")],
            destinationBucket: this.websiteBucket,
            distribution: this.cdn,
            distributionPaths: ["/*"]
        });

        const cfAliasRecord = new route53.ARecord(this, `${domainNameId}CfAliasRecord`, {
            recordName: wwwSiteDomain,
            target: route53.RecordTarget.fromAlias(
                new targets.CloudFrontTarget(this.cdn)
            ),
            zone
        });

        certSans.map(certName => {
            const nameToPascalCase = X8Website.domainNameToPascalCase(certName);

            new route53.ARecord(this, `${nameToPascalCase}WwwAliasRecord`, {
                recordName: certName,
                target: route53.RecordTarget.fromAlias(
                    new targets.Route53RecordTarget(cfAliasRecord)
                ),
                zone
            });

            new CfnOutput(this, `${nameToPascalCase}UrlOutput`, {
                value: certName
            });
        })

        new CfnOutput(this, "Bucket", { value: this.websiteBucket.bucketName });
        new CfnOutput(this, "Certificate", { value: certificate.certificateArn });
        new CfnOutput(this, "DistributionId", {value: this.cdn.distributionId});
        new CfnOutput(this, "WebsiteUrl", { value: "https://" + wwwSiteDomain });
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

    getDistributionDomains(props: X8WebSiteProps): string[] {
        return this.getCertificateDomains(props).concat([this.getSiteDomain(props)])
    }

    getSiteDomain(props: X8WebSiteProps): string {
        const wwwSubDomain = "www";
        if (props.waSubDomain && props.waSubDomain != wwwSubDomain) {
            return `${wwwSubDomain}.${props.waSubDomain}.${props.waDomainName}`
        } else {
            return`${wwwSubDomain}.${props.waDomainName}`
        }
    }

    getCertificateDomains(props: X8WebSiteProps): string[] {
        const wwwSubDomain = "www";
        let certificateDomains: string[] = []

        if (props.waSubDomain && props.waSubDomain != wwwSubDomain) {
            certificateDomains = certificateDomains.concat([`${props.waSubDomain}.${props.waDomainName}`])
        } else {
            certificateDomains = certificateDomains.concat( [props.waDomainName] )
        }

        if(props.waAdditionalDomainNames) {
            certificateDomains = certificateDomains.concat(props.waAdditionalDomainNames)
        }

        return certificateDomains
    }
}
