<script lang="ts">
    import 'simplebar'
    import {Offcanvas, Row, Col, Tooltip} from '@sveltestrap/sveltestrap';
    import Icon from "@iconify/svelte";

    const avatar6 = "/images/users/avatar-6.jpg"
    const avatar7 = "/images/users/avatar-7.jpg"
    const small3 = "/images/small/img-3.jpg"
    const small4 = "/images/small/img-4.jpg"
    const small6 = "/images/small/img-6.jpg"

    export let isActivityOpen: boolean
</script>

<Offcanvas placement="end" isOpen={isActivityOpen} toggle={() => isActivityOpen = !isActivityOpen}
           class="border-0"
           id="activity-offcanvas"
           header="Activity Stream"
           style="max-width: 450px; width: 100%">

    <div class="p-0">
        <div data-simplebar class="h-100 py-4">
            <div class="position-relative ms-3">

                <span class="position-absolute start-0 top-0 border border-dashed h-100"></span>

                <div class="position-relative ps-4">
                    <div class="mb-4">
              <span
                      class="position-absolute start-0 avatar-sm translate-middle-x bg-danger d-inline-flex align-items-center justify-content-center rounded-circle text-light fs-20">
                <Icon icon="iconamoon:folder-check-duotone"/>
              </span>
                        <div class="ms-2">
                            <h5 class="mb-1 text-dark fw-semibold fs-15 lh-base">
                                Report-Fix / Update
                            </h5>
                            <p class="d-flex align-items-center">
                                Add 3 files to
                                <span class="d-flex align-items-center text-primary ms-1">
                    <Icon icon="iconamoon:file-light"/>
                    Tasks
                  </span>
                            </p>
                            <div class="bg-light bg-opacity-50 rounded-2 p-2">
                                <Row>
                                    <Col lg="6" class="border-end border-light">
                                        <div class="d-flex align-items-center gap-2">
                                            <i class="bx bxl-figma fs-20 text-red"></i>
                                            <a href="#!" class="text-dark fw-medium">Concept.fig</a>
                                        </div>
                                    </Col>
                                    <Col lg="6">
                                        <div class="d-flex align-items-center gap-2">
                                            <i class="bx bxl-file-doc fs-20 text-success"></i>
                                            <a href="#!" class="text-dark fw-medium">reback.docs</a>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                            <h6 class="mt-2 text-muted">
                                Monday , 4:24 PM
                            </h6>
                        </div>
                    </div>
                </div>

                <div class="position-relative ps-4">
                    <div class="mb-4">
              <span
                      class="position-absolute start-0 avatar-sm translate-middle-x bg-success d-inline-flex align-items-center justify-content-center rounded-circle text-light fs-20">
                <Icon icon="iconamoon:check-circle-1-duotone"/>
              </span>
                        <div class="ms-2">
                            <h5 class="mb-1 text-dark fw-semibold fs-15 lh-base">
                                Project Status
                            </h5>
                            <p class="d-flex align-items-center mb-0">
                                Marked<span
                                    class="d-flex align-items-center text-primary mx-1">
                  <Icon icon="iconamoon:file-light"/>
                  Design
                </span>
                                as
                                <span
                                        class="badge bg-success-subtle text-success px-2 py-1 ms-1">Completed</span>
                            </p>
                            <div
                                    class="d-flex align-items-center gap-3 mt-1 bg-light bg-opacity-50 p-2 rounded-2">
                                <a href="#!" class="fw-medium text-dark">UI/UX Figma Design</a>
                                <div class="ms-auto">
                                    <a href="#!" id="download"
                                       class="fw-medium text-primary fs-18">
                                        <Icon icon="iconamoon:cloud-download-duotone"/>
                                    </a>
                                    <Tooltip target="download" placement="top">
                                        <span>Download</span>
                                    </Tooltip>
                                </div>
                            </div>
                            <h6 class="mt-3 text-muted">
                                Monday , 3:00 PM
                            </h6>
                        </div>
                    </div>
                </div>

                <div class="position-relative ps-4">
                    <div class="mb-4">
              <span
                      class="position-absolute start-0 avatar-sm translate-middle-x bg-primary d-inline-flex align-items-center justify-content-center rounded-circle text-light fs-16">UI</span>
                        <div class="ms-2">
                            <h5 class="mb-1 text-dark fw-semibold fs-15">
                                Reback Application UI v2.0.0
                                <span class="badge bg-primary-subtle text-primary px-2 py-1 ms-1">
                    Latest
                  </span>
                            </h5>
                            <p>
                                Get access to over 20+ pages including a
                                dashboard layout, charts, kanban board,
                                calendar, and pre-order E-commerce &
                                Marketing pages.
                            </p>
                            <div class="mt-2">
                                <a href="#!" class="btn btn-light btn-sm">Download Zip</a>
                            </div>
                            <h6 class="mt-3 text-muted">
                                Monday , 2:10 PM
                            </h6>
                        </div>
                    </div>
                </div>

                <div class="position-relative ps-4">
                    <div class="mb-4">
              <span
                      class="position-absolute start-0 translate-middle-x bg-success bg-gradient d-inline-flex align-items-center justify-content-center rounded-circle text-light fs-20">
                <img src={avatar7}
                     alt="avatar-5"
                     class="avatar-sm rounded-circle"/>
              </span>
                        <div class="ms-2">
                            <h5
                                    class="mb-0 text-dark fw-semibold fs-15 lh-base">
                                Alex Smith Attached Photos
                            </h5>
                            <Row class="g-2 mt-2">
                                <Col lg="4">
                                    <a href="#!">
                                        <img src={small6} alt="" class="img-fluid rounded"/>
                                    </a>
                                </Col>
                                <Col lg="4">
                                    <a href="#!">
                                        <img src={small3} alt="" class="img-fluid rounded"/>
                                    </a>
                                </Col>
                                <Col lg="4">
                                    <a href="#!">
                                        <img src={small4} alt="" class="img-fluid rounded"/>
                                    </a>
                                </Col>
                            </Row>
                            <h6 class="mt-3 text-muted">Monday 1:00 PM</h6>
                        </div>
                    </div>
                </div>

                <div class="position-relative ps-4">
                    <div class="mb-4">
              <span
                      class="position-absolute start-0 translate-middle-x bg-success bg-gradient d-inline-flex align-items-center justify-content-center rounded-circle text-light fs-20">
                <img src={avatar6}
                     alt="avatar-5"
                     class="avatar-sm rounded-circle"/>
              </span>
                        <div class="ms-2">
                            <h5 class="mb-0 text-dark fw-semibold fs-15 lh-base">
                                Rebecca J. added a new team member
                            </h5>
                            <p class="d-flex align-items-center gap-1">
                                <Icon icon="iconamoon:check-circle-1-duotone" class="text-success"/>
                                Added a new member to Front Dashboard
                            </p>
                            <h6 class="mt-3 text-muted">Monday 10:00 AM</h6>
                        </div>
                    </div>
                </div>

                <div class="position-relative ps-4">
                    <div class="mb-4">
              <span
                      class="position-absolute start-0 avatar-sm translate-middle-x bg-warning d-inline-flex align-items-center justify-content-center rounded-circle text-light fs-20">
                <Icon icon="iconamoon:certificate-badge-duotone"/>
              </span>
                        <div class="ms-2">
                            <h5 class="mb-0 text-dark fw-semibold fs-15 lh-base">
                                Achievements
                            </h5>
                            <p class="d-flex align-items-center gap-1 mt-1">
                                Earned a
                                <Icon icon="iconamoon:certificate-badge-duotone"
                                      class="text-danger fs-20"/>
                                " Best Product Award"
                            </p>
                            <h6 class="mt-3 text-muted">Monday 9:30 AM</h6>
                        </div>
                    </div>
                </div>

            </div>
            <a href="#!" class="btn btn-outline-dark w-100">View All</a>
        </div>
    </div>
</Offcanvas>