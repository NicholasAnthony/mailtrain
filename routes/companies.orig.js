"use strict";

// let config = require("config");
let openpgp = require("openpgp");
let passport = require("../lib/passport");
let express = require("express");
let router = new express.Router();
let companies = require("../lib/models/companies");
let lists = require("../lib/models/lists");
let campaigns = require("../lib/models/campaigns");
let users = require("../lib/models/users");
let feeds = require("../lib/models/feeds");

let fields = require("../lib/models/fields");
let forms = require("../lib/models/forms");
let tools = require("../lib/tools");
let striptags = require("striptags");
let htmlescape = require("escape-html");
let multer = require("multer");
let os = require("os");
let humanize = require("humanize");
let mkdirp = require("mkdirp");
let pathlib = require("path");
let log = require("npmlog");
let _ = require("../lib/translate")._;
let util = require("util");

let csvparse = require("csv-parse");
let fs = require("fs");
let moment = require("moment-timezone");

router.all("/*", (req, res, next) => {
  if (!req.user) {
    req.flash("danger", _("Need to be logged in to access restricted content"));
    return res.redirect(
      "/users/login?next=" + encodeURIComponent(req.originalUrl)
    );
  }
  res.setSelectedMenu("companies");
  next();
});

router.get("/", (req, res) => {
  res.render("companies/companies", {
    title: _("Companies"),
  });
});

router.get("/create", passport.csrfProtection, (req, res) => {
  let data = tools.convertKeys(req.query, {
    skip: ["layout"],
  });

  data.csrfToken = req.csrfToken();

  //   if (!("publicSubscribe" in data)) {
  //     data.publicSubscribe = true;
  //   }

  //   data.unsubscriptionModeOptions = getUnsubscriptionModeOptions(
  //     data.unsubscriptionMode || companies.UnsubscriptionMode.ONE_STEP
  //   );

  res.render("companies/create", data);
});

router.post(
  "/create",
  passport.parseForm,
  passport.csrfProtection,
  (req, res) => {
    companies.create(req.body, (err, id) => {
      if (err || !id) {
        req.flash(
          "danger",
          (err && err.message) || err || _("Could not create company")
        );
        return res.redirect("/companies/create?" + tools.queryParams(req.body));
      }
      req.flash("success", _("Company created"));
      res.redirect("/companies/view/" + id);
    });
  }
);

router.get("/edit/:id", passport.csrfProtection, (req, res) => {
  companies.get(req.params.id, (err, company) => {
    if (err || !company) {
      req.flash(
        "danger",
        (err && err.message) ||
          err ||
          _("Could not find company with specified ID")
      );
      return res.redirect("/companies");
    }

    forms.company(company.id, (err, customForms) => {
      if (err) {
        req.flash("danger", err.message || err);
        return res.redirect("/companies");
      }

      company.customForms = customForms.map((row) => {
        row.selected = company.defaultForm === row.id;
        return row;
      });

      company.unsubscriptionModeOptions = getUnsubscriptionModeOptions(
        company.unsubscriptionMode
      );

      company.csrfToken = req.csrfToken();
      res.render("companies/edit", company);
    });
  });
});

router.post(
  "/edit",
  passport.parseForm,
  passport.csrfProtection,
  (req, res) => {
    companies.update(req.body.id, req.body, (err, updated) => {
      if (err) {
        req.flash("danger", err.message || err);
      } else if (updated) {
        req.flash("success", _("Company settings updated"));
      } else {
        req.flash("info", _("Company settings not updated"));
      }

      if (req.query.next) {
        return res.redirect(req.query.next);
      } else if (req.body.id) {
        return res.redirect(
          "/companies/edit/" + encodeURIComponent(req.body.id)
        );
      } else {
        return res.redirect("/companies");
      }
    });
  }
);

router.post(
  "/delete",
  passport.parseForm,
  passport.csrfProtection,
  (req, res) => {
    companies.delete(req.body.id, (err, deleted) => {
      if (err) {
        req.flash("danger", (err && err.message) || err);
      } else if (deleted) {
        req.flash("success", _("Company deleted"));
      } else {
        req.flash("info", _("Could not delete specified company"));
      }

      return res.redirect("/companies");
    });
  }
);

router.post("/ajax", (req, res) => {
  console.log("ajax");
  return res.json({[]});
  // companies.filter(
  //   req.body,
  //   Number(req.query.parent) || false,
  //   (err, data, total, filteredTotal) => {
  //     if (err) {
  //       return res.json({
  //         error: err.message || err,
  //         data: [],
  //       });
  //     }

  //     // [number, name, cid, description, edit]
  //     res.json({
  //       draw: req.body.draw,
  //       recordsTotal: total,
  //       recordsFiltered: filteredTotal,
  //       data: data.map((row, i) => [
  //         (Number(req.body.start) || 0) + 1 + i,
  //         '<span class="glyphicon glyphicon-company-alt" aria-hidden="true"></span> <a href="/companies/view/' +
  //           row.id +
  //           '">' +
  //           htmlescape(row.name || "") +
  //           "</a>",
  //         "<code>" + row.cid + "</code>",
  //         "<span>" + htmlescape(row.url || "") + "</span>",
  //         htmlescape(striptags(row.description) || ""),
  //         '<span class="glyphicon glyphicon-wrench" aria-hidden="true"></span><a href="/companies/edit/' +
  //           row.id +
  //           '">' +
  //           _("Edit") +
  //           "</a>",
  //       ]),
  //     });
  //   }
  // );
});

router.post("/ajax/:id", (req, res) => {
  companies.get(req.params.id, (err, company) => {
    if (err || !company) {
      return res.json({
        error: (err && err.message) || err || _("Company not found"),
        data: [],
      });
    }

    fields.company(company.id, (err, fieldCompany) => {
      if (err && !fieldCompany) {
        fieldCompany = [];
      }

      let columns = ["#", "email", "first_name", "last_name"]
        .concat(
          fieldCompany
            .filter((field) => field.visible)
            .map((field) => field.column)
        )
        .concat(["status", "created"]);

      subscriptions.filter(
        company.id,
        req.body,
        columns,
        req.query.segment,
        (err, data, total, filteredTotal) => {
          if (err) {
            return res.json({
              error: err.message || err,
              data: [],
            });
          }

          data.forEach((row) => {
            row.subscriptionStatus = row.status === 1 ? true : false;
            row.customFields = fields.getRow(fieldCompany, row);
          });

          let statuses = [
            _("Unknown"),
            _("Subscribed"),
            _("Unsubscribed"),
            _("Bounced"),
            _("Complained"),
          ];

          res.json({
            draw: req.body.draw,
            recordsTotal: total,
            recordsFiltered: filteredTotal,
            data: data.map((row, i) =>
              [
                (Number(req.body.start) || 0) + 1 + i,
                htmlescape(row.email || ""),
                htmlescape(row.firstName || ""),
                htmlescape(row.lastName || ""),
              ]
                .concat(
                  fields.getRow(fieldCompany, row).map((cRow) => {
                    if (cRow.type === "number") {
                      return htmlescape(
                        (cRow.value && humanize.numberFormat(cRow.value, 0)) ||
                          ""
                      );
                    } else if (cRow.type === "longtext") {
                      let value = cRow.value || "";
                      if (value.length > 50) {
                        value = value.substr(0, 47).trim() + "…";
                      }
                      return htmlescape(value);
                    } else if (cRow.type === "gpg") {
                      let value = (cRow.value || "").trim();
                      try {
                        value = openpgp.key.readArmored(value);
                        if (value) {
                          let keys = value.keys;
                          for (let i = 0; i < keys.length; i++) {
                            let key = keys[i];
                            switch (key.verifyPrimaryKey()) {
                              case 0:
                                return _("Invalid key");
                              case 1:
                                return _("Expired key");
                              case 2:
                                return _("Revoked key");
                            }
                          }

                          value =
                            value.keys &&
                            value.keys[0] &&
                            value.keys[0].primaryKey.fingerprint;
                          if (value) {
                            value = "0x" + value.substr(-16).toUpperCase();
                          }
                        }
                      } catch (E) {
                        value = "parse error";
                      }
                      return htmlescape(value || "");
                    } else {
                      return htmlescape(cRow.value || "");
                    }
                  })
                )
                .concat(statuses[row.status])
                .concat(
                  row.created && row.created.toISOString
                    ? '<span class="datestring" data-date="' +
                        row.created.toISOString() +
                        '" title="' +
                        row.created.toISOString() +
                        '">' +
                        row.created.toISOString() +
                        "</span>"
                    : "N/A"
                )
                .concat(
                  '<a href="/companies/subscription/' +
                    company.id +
                    "/edit/" +
                    row.cid +
                    '">' +
                    _("Edit") +
                    "</a>"
                )
            ),
          });
        }
      );
    });
  });
});

router.get("/view/:id", passport.csrfProtection, (req, res) => {
  if (Number(req.query.segment) === -1) {
    return res.redirect(
      "/segments/" + encodeURIComponent(req.params.id) + "/create"
    );
  }

  companies.get(req.params.id, (err, company) => {
    if (err || !company) {
      req.flash(
        "danger",
        (err && err.message) ||
          err ||
          _("Could not find company with specified ID")
      );
      return res.redirect("/companies");
    }

    subscriptions.companyImports(company.id, (err, imports) => {
      if (err) {
        // not important, ignore
        imports = [];
      }

      fields.company(company.id, (err, fieldCompany) => {
        if (err && !fieldCompany) {
          fieldCompany = [];
        }

        company.imports = imports.map((entry, i) => {
          entry.index = i + 1;
          entry.importType =
            entry.type === 0
              ? _("Subscribe")
              : entry.type === 1
              ? _("Force Subscribe")
              : _("Unsubscribe");
          switch (entry.status) {
            case 0:
              entry.importStatus = _("Initializing");
              break;
            case 1:
              entry.importStatus = _("Initialized");
              break;
            case 2:
              entry.importStatus = _("Importing") + "…";
              break;
            case 3:
              entry.importStatus = _("Finished");
              break;
            default:
              entry.importStatus =
                _("Errored") + (entry.error ? " (" + entry.error + ")" : "");
              entry.error = true;
          }
          entry.created = entry.created && entry.created.toISOString();
          entry.finished = entry.finished && entry.finished.toISOString();
          entry.updated = entry.processed - entry.new;
          entry.processed = humanize.numberFormat(entry.processed, 0);
          return entry;
        });
        company.csrfToken = req.csrfToken();
        company.customFields = fieldCompany.filter((field) => field.visible);
        company.customSort = company.customFields.length
          ? "," + company.customFields.map(() => "0").join(",")
          : "";

        company.showSubscriptions =
          req.query.tab === "subscriptions" || !req.query.tab;
        company.showImports = req.query.tab === "imports";

        company.segments.forEach((segment) => {
          if (segment.id === (Number(req.query.segment) || 0)) {
            segment.selected = true;
            company.useSegment = req.query.segment;
            company.segment = segment.id;
          }
        });

        res.render("companies/view", company);
      });
    });
  });
});

//
//
//
//
//
//
//
//
//
//
//
//
// SUBSCRIPTION ENDPOINTS
// router.get("/subscription/:id/add", passport.csrfProtection, (req, res) => {
// //   companies.get(req.params.id, (err, company) => {
// //     if (err || !company) {
// //       req.flash(
// //         "danger",
// //         (err && err.message) ||
// //           err ||
// //           _("Could not find company with specified ID")
// //       );
// //       return res.redirect("/companies");
// //     }

// //     fields.company(company.id, (err, fieldCompany) => {
// //       if (err && !fieldCompany) {
// //         fieldCompany = [];
// //       }

// //       let data = tools.convertKeys(req.query, {
// //         skip: ["layout"],
// //       });

// //       data.company = company;
// //       data.csrfToken = req.csrfToken();

// //       data.customFields = fields.getRow(fieldCompany, data, false, true);
// //       data.useEditor = true;

// //       data.timezones = moment.tz.names().map((tz) => {
// //         let selected = false;
// //         if (
// //           tz.toLowerCase().trim() === (data.tz || "UTC").toLowerCase().trim()
// //         ) {
// //           selected = true;
// //         }
// //         return {
// //           key: tz,
// //           value: tz,
// //           selected,
// //         };
// //       });

// //       res.render("companies/subscription/add", data);
// //     });
// //   });
// });

// router.get("/subscription/:id/edit/:cid", passport.csrfProtection, (req, res) => {
//     // companies.get(req.params.id, (err, company) => {
//     //   if (err || !company) {
//     //     req.flash(
//     //       "danger",
//     //       (err && err.message) ||
//     //         err ||
//     //         _("Could not find company with specified ID")
//     //     );
//     //     return res.redirect("/companies");
//     //   }

//     //   subscriptions.get(company.id, req.params.cid, (err, subscription) => {
//     //     if (err || !subscription) {
//     //       req.flash(
//     //         "danger",
//     //         (err && err.message) ||
//     //           err ||
//     //           _("Could not find subscriber with specified ID")
//     //       );
//     //       return res.redirect("/companies/view/" + req.params.id);
//     //     }

//     //     fields.company(company.id, (err, fieldCompany) => {
//     //       if (err && !fieldCompany) {
//     //         fieldCompany = [];
//     //       }

//     //       subscription.company = company;
//     //       subscription.csrfToken = req.csrfToken();

//     //       subscription.customFields = fields.getRow(
//     //         fieldCompany,
//     //         subscription,
//     //         false,
//     //         true
//     //       );
//     //       subscription.useEditor = true;
//     //       subscription.isSubscribed = subscription.status === 1;

//     //       let tzfound = false;
//     //       subscription.timezones = moment.tz.names().map((tz) => {
//     //         let selected = false;
//     //         if (
//     //           tz.toLowerCase().trim() ===
//     //           (subscription.tz || "").toLowerCase().trim()
//     //         ) {
//     //           selected = true;
//     //           tzfound = true;
//     //         }
//     //         return {
//     //           key: tz,
//     //           value: tz,
//     //           selected,
//     //         };
//     //       });
//     //       if (!tzfound && subscription.tz) {
//     //         subscription.timezones.push({
//     //           key: subscription.tz,
//     //           value: subscription.tz,
//     //           selected: true,
//     //         });
//     //       }

//     //       res.render("companies/subscription/edit", subscription);
//     //     });
//     //   });
//     // });
//   }
// );

// router.post("/subscription/add", passport.parseForm, passport.csrfProtection, (req, res) => {
//     // subscriptions.insert(req.body.company, false, req.body, (err, response) => {
//     //   if (err) {
//     //     req.flash(
//     //       "danger",
//     //       (err && err.message) || err || _("Could not add subscription")
//     //     );
//     //     return res.redirect(
//     //       "/companies/subscription/" +
//     //         encodeURIComponent(req.body.company) +
//     //         "/add?" +
//     //         tools.queryParams(req.body)
//     //     );
//     //   }

//     //   if (response.entryId) {
//     //     req.flash(
//     //       "success",
//     //       util.format(
//     //         _("%s was successfully added to your company"),
//     //         req.body.email
//     //       )
//     //     );
//     //   } else {
//     //     req.flash(
//     //       "warning",
//     //       util.format(_("%s was not added to your company"), req.body.email)
//     //     );
//     //   }

//     //   res.redirect(
//     //     "/companies/subscription/" +
//     //       encodeURIComponent(req.body.company) +
//     //       "/add"
//     //   );
//     // });
//   }
// );

// router.post("/subscription/unsubscribe", passport.parseForm, passport.csrfProtection, (req, res) => {
//     // companies.get(req.body.company, (err, company) => {
//     //   if (err || !company) {
//     //     req.flash(
//     //       "danger",
//     //       (err && err.message) ||
//     //         err ||
//     //         _("Could not find company with specified ID")
//     //     );
//     //     return res.redirect("/companies");
//     //   }

//     //   subscriptions.get(company.id, req.body.cid, (err, subscription) => {
//     //     if (err || !subscription) {
//     //       req.flash(
//     //         "danger",
//     //         (err && err.message) ||
//     //           err ||
//     //           _("Could not find subscriber with specified ID")
//     //       );
//     //       return res.redirect("/companies/view/" + company.id);
//     //     }

//     //     subscriptions.changeStatus(
//     //       company.id,
//     //       subscription.id,
//     //       false,
//     //       subscriptions.Status.UNSUBSCRIBED,
//     //       (err, found) => {
//     //         if (err) {
//     //           req.flash(
//     //             "danger",
//     //             (err && err.message) || err || _("Could not unsubscribe user")
//     //           );
//     //           return res.redirect(
//     //             "/companies/subscription/" +
//     //               company.id +
//     //               "/edit/" +
//     //               subscription.cid
//     //           );
//     //         }
//     //         req.flash(
//     //           "success",
//     //           util.format(
//     //             _("%s was successfully unsubscribed from your company"),
//     //             subscription.email
//     //           )
//     //         );
//     //         res.redirect("/companies/view/" + company.id);
//     //       }
//     //     );
//     //   });
//     // });
//   }
// );

// router.post("/subscription/delete", passport.parseForm, passport.csrfProtection, (req, res) => {
//     // companies.get(req.body.company, (err, company) => {
//     //   if (err || !company) {
//     //     req.flash(
//     //       "danger",
//     //       (err && err.message) ||
//     //         err ||
//     //         _("Could not find company with specified ID")
//     //     );
//     //     return res.redirect("/companies");
//     //   }

//     //   subscriptions.delete(company.id, req.body.cid, (err, email) => {
//     //     if (err || !email) {
//     //       req.flash(
//     //         "danger",
//     //         (err && err.message) ||
//     //           err ||
//     //           _("Could not find subscriber with specified ID")
//     //       );
//     //       return res.redirect("/companies/view/" + company.id);
//     //     }

//     //     req.flash(
//     //       "success",
//     //       util.format(_("%s was successfully removed from your company"), email)
//     //     );
//     //     res.redirect("/companies/view/" + company.id);
//     //   });
//     // });
//   }
// );

// router.post("/subscription/edit", passport.parseForm, passport.csrfProtection, (req, res) => {
//     // req.body["is-test"] = req.body["is-test"] ? "1" : "0";
//     // subscriptions.update(
//     //   req.body.company,
//     //   req.body.cid,
//     //   req.body,
//     //   true,
//     //   (err, updated) => {
//     //     if (err) {
//     //       if (err.code === "ER_DUP_ENTRY") {
//     //         req.flash(
//     //           "danger",
//     //           util.format(
//     //             _("Another subscriber with email address %s already exists"),
//     //             req.body.email
//     //           )
//     //         );
//     //         return res.redirect(
//     //           "/companies/subscription/" +
//     //             encodeURIComponent(req.body.company) +
//     //             "/edit/" +
//     //             req.body.cid
//     //         );
//     //       } else {
//     //         req.flash("danger", err.message || err);
//     //       }
//     //     } else if (updated) {
//     //       req.flash("success", _("Subscription settings updated"));
//     //     } else {
//     //       req.flash("info", _("Subscription settings not updated"));
//     //     }

//     //     if (req.body.company) {
//     //       return res.redirect(
//     //         "/companies/view/" + encodeURIComponent(req.body.company)
//     //       );
//     //     } else {
//     //       return res.redirect("/companies");
//     //     }
//     //   }
//     // );
//   }
// );

// router.get("/subscription/:id/import", passport.csrfProtection, (req, res) => {
// //   companies.get(req.params.id, (err, company) => {
// //     if (err || !company) {
// //       req.flash(
// //         "danger",
// //         (err && err.message) ||
// //           err ||
// //           _("Could not find company with specified ID")
// //       );
// //       return res.redirect("/companies");
// //     }

// //     let data = tools.convertKeys(req.query, {
// //       skip: ["layout"],
// //     });

// //     if (!("delimiter" in data)) {
// //       data.delimiter = ",";
// //     }

// //     data.company = company;
// //     data.csrfToken = req.csrfToken();

// //     res.render("companies/subscription/import", data);
// //   });
// });

// router.get("/subscription/:id/import/:importId", passport.csrfProtection, (req, res) => {
//     // companies.get(req.params.id, (err, company) => {
//     //   if (err || !company) {
//     //     req.flash(
//     //       "danger",
//     //       (err && err.message) ||
//     //         err ||
//     //         _("Could not find company with specified ID")
//     //     );
//     //     return res.redirect("/companies");
//     //   }

//     //   subscriptions.getImport(
//     //     req.params.id,
//     //     req.params.importId,
//     //     (err, data) => {
//     //       if (err || !data) {
//     //         req.flash(
//     //           "danger",
//     //           (err && err.message) ||
//     //             err ||
//     //             _("Could not find import data with specified ID")
//     //         );
//     //         return res.redirect("/companies");
//     //       }

//     //       fields.company(company.id, (err, fieldCompany) => {
//     //         if (err && !fieldCompany) {
//     //           fieldCompany = [];
//     //         }

//     //         data.company = company;
//     //         data.csrfToken = req.csrfToken();

//     //         data.customFields = fields.getRow(fieldCompany, data, false, true);

//     //         res.render("companies/subscription/import-preview", data);
//     //       });
//     //     }
//     //   );
//     // });
//   }
// );

// router.post("/subscription/import", uploads.single("companyimport"), passport.parseForm, passport.csrfProtection, (req, res) => {
//     // companies.get(req.body.company, (err, company) => {
//     //   if (err || !company) {
//     //     req.flash(
//     //       "danger",
//     //       (err && err.message) ||
//     //         err ||
//     //         _("Could not find company with specified ID")
//     //     );
//     //     return res.redirect("/companies");
//     //   }

//     //   let delimiter = (req.body.delimiter || "").trim().charAt(0) || ",";

//     //   getPreview(req.file.path, req.file.size, delimiter, (err, rows) => {
//     //     if (err) {
//     //       req.flash(
//     //         "danger",
//     //         (err && err.message) || err || _("Could not process CSV")
//     //       );
//     //       return res.redirect("/companies");
//     //     } else {
//     //       let type = 0; // Use the existing subscription status or SUBSCRIBED
//     //       if (req.body.type === "force_subscribed") {
//     //         type = subscriptions.Status.SUBSCRIBED;
//     //       } else if (req.body.type === "unsubscribed") {
//     //         type = subscriptions.Status.UNSUBSCRIBED;
//     //       }

//     //       subscriptions.createImport(
//     //         company.id,
//     //         type,
//     //         req.file.path,
//     //         req.file.size,
//     //         delimiter,
//     //         req.body.emailcheck === "enabled" ? 1 : 0,
//     //         {
//     //           columns: rows[0],
//     //           example: rows[1] || [],
//     //         },
//     //         (err, importId) => {
//     //           if (err) {
//     //             req.flash(
//     //               "danger",
//     //               (err && err.message) || err || _("Could not create importer")
//     //             );
//     //             return res.redirect("/companies");
//     //           }

//     //           return res.redirect(
//     //             "/companies/subscription/" + company.id + "/import/" + importId
//     //           );
//     //         }
//     //       );
//     //     }
//     //   });
//     // });
//   }
// );

// router.post("/subscription/import-confirm", passport.parseForm, passport.csrfProtection, (req, res) => {
//     // companies.get(req.body.company, (err, company) => {
//     //   if (err || !company) {
//     //     req.flash(
//     //       "danger",
//     //       (err && err.message) ||
//     //         err ||
//     //         _("Could not find company with specified ID")
//     //     );
//     //     return res.redirect("/companies");
//     //   }

//     //   subscriptions.getImport(company.id, req.body.import, (err, data) => {
//     //     if (err || !data) {
//     //       req.flash(
//     //         "danger",
//     //         (err && err.message) ||
//     //           err ||
//     //           _("Could not find import data with specified ID")
//     //       );
//     //       return res.redirect("/companies");
//     //     }

//     //     fields.company(company.id, (err, fieldCompany) => {
//     //       if (err && !fieldCompany) {
//     //         fieldCompany = [];
//     //       }

//     //       let allowedColumns = ["email", "first_name", "last_name", "tz"];
//     //       fieldCompany.forEach((field) => {
//     //         if (field.column) {
//     //           allowedColumns.push(field.column);
//     //         }
//     //         if (field.options) {
//     //           field.options.forEach((subField) => {
//     //             if (subField.column) {
//     //               allowedColumns.push(subField.column);
//     //             }
//     //           });
//     //         }
//     //       });

//     //       data.mapping.mapping = {};
//     //       data.mapping.columns.forEach((column, i) => {
//     //         let colIndex = allowedColumns.indexOf(req.body["column-" + i]);
//     //         if (colIndex >= 0) {
//     //           data.mapping.mapping[allowedColumns[colIndex]] = i;
//     //         }
//     //       });

//     //       subscriptions.updateImport(
//     //         company.id,
//     //         req.body.import,
//     //         {
//     //           status: 1,
//     //           mapping: JSON.stringify(data.mapping),
//     //         },
//     //         (err, importer) => {
//     //           if (err || !importer) {
//     //             req.flash(
//     //               "danger",
//     //               (err && err.message) ||
//     //                 err ||
//     //                 _("Could not find import data with specified ID")
//     //             );
//     //             return res.redirect("/companies");
//     //           }

//     //           req.flash("success", _("Import started"));
//     //           res.redirect("/companies/view/" + company.id + "?tab=imports");
//     //         }
//     //       );
//     //     });
//     //   });
//     // });
//   }
// );

// router.post("/subscription/import-restart", passport.parseForm, passport.csrfProtection, (req, res) => {
//     // companies.get(req.body.company, (err, company) => {
//     //   if (err || !company) {
//     //     req.flash(
//     //       "danger",
//     //       (err && err.message) ||
//     //         err ||
//     //         _("Could not find company with specified ID")
//     //     );
//     //     return res.redirect("/companies");
//     //   }

//     //   subscriptions.updateImport(
//     //     company.id,
//     //     req.body.import,
//     //     {
//     //       status: 1,
//     //       error: null,
//     //       finished: null,
//     //       processed: 0,
//     //       new: 0,
//     //       failed: 0,
//     //     },
//     //     (err, importer) => {
//     //       if (err || !importer) {
//     //         req.flash(
//     //           "danger",
//     //           (err && err.message) ||
//     //             err ||
//     //             _("Could not find import data with specified ID")
//     //         );
//     //         return res.redirect("/companies");
//     //       }

//     //       req.flash("success", _("Import restarted"));
//     //       res.redirect("/companies/view/" + company.id + "?tab=imports");
//     //     }
//     //   );
//     // });
//   }
// );

// router.get("/subscription/:id/import/:importId/failed", (req, res) => {
//   let start = 0;
// //   companies.get(req.params.id, (err, company) => {
// //     if (err || !company) {
// //       req.flash(
// //         "danger",
// //         (err && err.message) ||
// //           err ||
// //           _("Could not find company with specified ID")
// //       );
// //       return res.redirect("/companies");
// //     }

// //     subscriptions.getImport(req.params.id, req.params.importId, (err, data) => {
// //       if (err || !data) {
// //         req.flash(
// //           "danger",
// //           (err && err.message) ||
// //             err ||
// //             _("Could not find import data with specified ID")
// //         );
// //         return res.redirect("/companies");
// //       }
// //       subscriptions.getFailedImports(req.params.importId, (err, rows) => {
// //         if (err) {
// //           req.flash("danger", (err && err.message) || err);
// //           return res.redirect("/companies");
// //         }

// //         data.rows = rows.map((row, i) => {
// //           row.index = start + i + 1;
// //           return row;
// //         });
// //         data.company = company;

// //         res.render("companies/subscription/import-failed", data);
// //       });
// //     });
// //   });
// });

// router.post("/quickcompany/ajax", (req, res) => {
// //   companies.filterQuickcompany(req.body, (err, data, total, filteredTotal) => {
// //     if (err) {
// //       return res.json({
// //         error: err.message || err,
// //         data: [],
// //       });
// //     }

// //     res.json({
// //       draw: req.body.draw,
// //       recordsTotal: total,
// //       recordsFiltered: filteredTotal,
// //       data: data.map((row, i) => ({
// //         0: (Number(req.body.start) || 0) + 1 + i,
// //         1:
// //           '<span class="glyphicon glyphicon-inbox" aria-hidden="true"></span> <a href="/companies/view/' +
// //           row.id +
// //           '">' +
// //           htmlescape(row.name || "") +
// //           "</a>",
// //         2: row.subscribers,
// //         DT_RowId: row.id,
// //       })),
// //     });
// //   });
// });

// function getPreview(path, size, delimiter, callback) {
//     // delimiter = (delimiter || "").trim().charAt(0) || ",";
//     // size = Number(size);

//     // fs.open(path, "r", (err, fd) => {
//     //   if (err) {
//     //     return callback(err);
//     //   }

//     //   let bufLen = size;
//     //   let maxReadSize = 10 * 1024;

//     //   if (size > maxReadSize) {
//     //     bufLen = maxReadSize;
//     //   }

//     //   let buffer = new Buffer(bufLen);
//     //   fs.read(fd, buffer, 0, buffer.length, 0, (err, bytesRead, buffer) => {
//     //     if (err) {
//     //       return callback(err);
//     //     }

//     //     let input = buffer.toString().trim();

//     //     if (size !== bufLen) {
//     //       // remove last incomplete line
//     //       input = input.split(/\r?\n/);
//     //       input.pop();
//     //       input = input.join("\n");
//     //     }

//     //     csvparse(
//     //       input,
//     //       {
//     //         comment: "#",
//     //         delimiter,
//     //       },
//     //       (err, data) => {
//     //         fs.close(fd, () => {
//     //           // just ignore
//     //         });
//     //         if (err) {
//     //           return callback(err);
//     //         }
//     //         if (!data || !data.length) {
//     //           return callback(new Error(_("Empty file")));
//     //         }
//     //         if (data.length < 2) {
//     //           return callback(new Error(_("Too few rows")));
//     //         }
//     //         callback(err, data);
//     //       }
//     //     );
//     //   });
//     // });
// }

// function getUnsubscriptionModeOptions(unsubscriptionMode) {
// //   const options = [];

// //   options[companies.UnsubscriptionMode.ONE_STEP] = {
// //     value: companies.UnsubscriptionMode.ONE_STEP,
// //     selected: unsubscriptionMode === companies.UnsubscriptionMode.ONE_STEP,
// //     label: _("One-step (i.e. no email with confirmation link)"),
// //   };

// //   options[companies.UnsubscriptionMode.ONE_STEP_WITH_FORM] = {
// //     value: companies.UnsubscriptionMode.ONE_STEP_WITH_FORM,
// //     selected:
// //       unsubscriptionMode === companies.UnsubscriptionMode.ONE_STEP_WITH_FORM,
// //     label: _(
// //       "One-step with unsubscription form (i.e. no email with confirmation link)"
// //     ),
// //   };

// //   options[companies.UnsubscriptionMode.TWO_STEP] = {
// //     value: companies.UnsubscriptionMode.TWO_STEP,
// //     selected: unsubscriptionMode === companies.UnsubscriptionMode.TWO_STEP,
// //     label: _("Two-step (i.e. an email with confirmation link will be sent)"),
// //   };

// //   options[companies.UnsubscriptionMode.TWO_STEP_WITH_FORM] = {
// //     value: companies.UnsubscriptionMode.TWO_STEP_WITH_FORM,
// //     selected:
// //       unsubscriptionMode === companies.UnsubscriptionMode.TWO_STEP_WITH_FORM,
// //     label: _(
// //       "Two-step with unsubscription form (i.e. an email with confirmation link will be sent)"
// //     ),
// //   };

// //   options[companies.UnsubscriptionMode.MANUAL] = {
// //     value: companies.UnsubscriptionMode.MANUAL,
// //     selected: unsubscriptionMode === companies.UnsubscriptionMode.MANUAL,
// //     label: _(
// //       "Manual (i.e. unsubscription has to be performed by the company administrator)"
// //     ),
// //   };

// //   return options;
// }

// let uploadStorage = multer.diskStorage({
// //   destination: (req, file, callback) => {
// //     log.verbose("tmpdir", os.tmpdir());
// //     let tmp = config.www.tmpdir || os.tmpdir();
// //     let dir = pathlib.join(tmp, "mailtrain");
// //     mkdirp(dir, (err) => {
// //       if (err) {
// //         log.error("Upload", err);
// //         log.verbose("Upload", "Storing upload to <%s>", tmp);
// //         return callback(null, tmp);
// //       }
// //       log.verbose("Upload", "Storing upload to <%s>", dir);
// //       callback(null, dir);
// //     });
// //   },
// });

// let uploads = multer({
//   storage: uploadStorage,
// });

module.exports = router;
