import {App, Stack} from "aws-cdk-lib";

let app: App;
let stack: Stack;

describe("X8 Website Tests", () => {

    beforeEach(() => {
        app = new App();
        stack = new Stack(app, "TestStack");
    });

    test("dummy test", () => {
    });

});