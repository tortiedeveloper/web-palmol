<script lang="ts">
    import AuthLayout from "$lib/layouts/AuthLayout.svelte";
    import LogoBox from "$lib/components/LogoBox.svelte";
    import SignWithOptions from "../components/SignWithOptions.svelte";
    import {Button, Card, CardBody, Col, Form, Input, Row} from "@sveltestrap/sveltestrap";

    const signInImg = '/images/sign-in.svg'
</script>

<AuthLayout>
    <Col xl="12">
        <Card class="auth-card">
            <CardBody class="p-0">
                <Row class="align-items-center g-0">
                    <Col lg="6" class="d-none d-lg-inline-block border-end">
                        <div class="auth-page-sidebar">
                            <img src={signInImg} alt="auth" class="img-fluid"/>
                        </div>
                    </Col>
                    <Col lg="6">
                        <div class="p-4">
                            <div class="mx-auto mb-4 text-center auth-logo">
                                <LogoBox/>
                            </div>

                            <h2 class="fw-bold text-center fs-18">Sign Up</h2>
                            <p class="text-muted text-center mt-1 mb-4">New to our platform? Sign up now! It only takes
                                a minute.</p>

                            <Row class="justify-content-center">
                                <Col md="8" xs="12">
                                    <Form class="authentication-form">
                                        <div class="mb-3">
                                            <label class="form-label" for="example-name">Name</label>
                                            <Input type="text" id="example-name" placeholder="Enter your name"/>
                                        </div>

                                        <div class="mb-3">
                                            <label class="form-label" for="example-email">Email</label>
                                            <Input type="email" id="example-email" placeholder="Enter your email"/>
                                        </div>

                                        <div class="mb-3">
                                            <label class="form-label" for="example-password">Password</label>
                                            <Input type="password" id="example-password" name="password"
                                                   placeholder="Enter your password"/>
                                        </div>

                                        <div class="mb-3">
                                            <Input type="checkbox" label="I accept Terms and Condition"/>
                                        </div>

                                        <div class="mb-1 text-center d-grid">
                                            <Button color="primary" type="submit"> Sign Up</Button>
                                        </div>
                                    </Form>

                                    <p class="mt-3 fw-semibold no-span">OR sign with</p>

                                    <SignWithOptions/>
                                </Col>
                            </Row>
                        </div>
                    </Col>
                </Row>
            </CardBody>
        </Card>

        <p class="text-white mb-0 text-center">
            Already have an account?
            <a href="/auth/sign-in" class="text-white fw-bold ms-1">Sign In</a>
        </p>
    </Col>
</AuthLayout>