/*globals $, EJS, COMMCAREHQ */

/*
This file was copied from case-config-ui-1.js, and then edited.
All additions are done using knockout, and can eventually replace all the old code.
 */

var CaseConfig = (function () {
    "use strict";
    ko.bindingHandlers.questionsOptions = {
        update: function (element, valueAccessor, allBindingsAccessor) {
            var value = valueAccessor();
            var options = value.options;
            var allowNull = value.allowNull === undefined ? true : value.allowNull;
            var allBindings = allBindingsAccessor();
            if (allowNull) {
                allBindings.optionsCaption = ' ';
            }
            allBindings.optstrText = function (question) {
                return SubCasesViewModel.prototype.getLabel(question);
            };
            return ko.bindingHandlers.optstr.update(element, function () {
                return options;
            });
        }
    };
    function SubCasesViewModel(o, utils) {
        var self = this, root = this;
        self.utils = utils;
        self.edit = ko.observable(self.utils.edit);
        var SubCase = {
            CaseProperty: {
                wrap: function (o, subcase) {
                    var property = ko.mapping.fromJS(o);
                    return SubCase.CaseProperty.make(property, subcase);
                },
                make: function (property, subcase) {
                    property.defaultKey = ko.computed(function () {
                        var path = property.path() || '';
                        var value = path.split('/');
                        value = value[value.length-1];
                        return value;
                    });
                    property.keyVal = ko.computed(function () {
                        return property.key() || property.defaultKey();
                    });
                    property.repeat_context = function () {
                        return self.utils.get_repeat_context(property.path());
                    };
                    property.validate = ko.computed(function () {
                        if (property.path() || property.keyVal()) {
                            if (subcase.propertyCounts()[property.keyVal()] > 1) {
                                return "Duplicate property";
                            } else if (root.utils.reserved_words.indexOf(property.keyVal()) !== -1) {
                                return '<strong>' + property.keyVal() + '</strong> is a reserved word';
                            } else if (property.repeat_context() && property.repeat_context() !== subcase.repeat_context()) {
                                return 'Inside the wrong repeat!'
                            }
                        }
                    });
                    return property;
                }
            },
            transforms: [
                {
                    read: function (o) {
                        var case_properties = [];

                        for (var key in o.case_properties) {
                            if (o.case_properties.hasOwnProperty(key)) {
                                case_properties.push({
                                    path: o.case_properties[key],
                                    key: key
                                });
                            }
                        }
                        case_properties = _.sortBy(case_properties, function (property) {
                            return self.utils.questionScores[property.path];
                        });
                        o.case_properties = case_properties;
                    },
                    write: function (o, self) {
                        var case_properties = {};
                        for (var i = 0; i < o.case_properties.length; i++) {
                            if (self.case_properties()[i].keyVal() || o.case_properties[i].path) {
                                case_properties[self.case_properties()[i].keyVal()] = o.case_properties[i].path;
                            }
                        }
                        o.case_properties = case_properties;
                    }
                },
                function (o) {
                    o.case_type = o.case_type || null;
                    o.case_name = o.case_name || null;
                    o.condition = o.condition || {
                        type: 'always',
                        question: null,
                        answer: null
                    };
                },
                {
                    write: function (o, self) {
                        o.repeat_context = self.repeat_context();
                    }
                }
            ],
            wrap: function (o) {
                var self, case_properties;

                ko.utils.arrayForEach(SubCase.transforms, function (transform) {
                    if (transform.hasOwnProperty('read')) {
                        transform.read(o);
                    } else {
                        if (typeof transform === 'function') {
                            transform(o);
                        }
                    }
                });
                case_properties = o.case_properties;
                o.case_properties = [];
                self = ko.mapping.fromJS(o);

                self.addProperty = function () {
                    var property = SubCase.CaseProperty.wrap({
                        path: '',
                        key: ''
                    }, self);

                    self.case_properties.push(property);
                };
                self.removeProperty = function (property) {
                    self.case_properties.remove(property);
                    root.utils.change();
                };
                self.propertyCounts = ko.computed(function () {
                    var count = {};
                    ko.utils.arrayForEach(self.case_properties(), function (p) {
                        var key = p.keyVal();
                        return count[key] = count[key] ? count[key] + 1 : 1;
                    });
                    return count;
                });
                self.repeat_context = function () {
                    return root.utils.get_repeat_context(self.case_name());
                };
                self.case_properties(ko.utils.arrayMap(case_properties, function (property) {
                    return SubCase.CaseProperty.wrap(property, self);
                }));
                self.unwrap = function () {
                    SubCase.unwrap(self);
                };

                return self;
            },
            unwrap: function (self) {
                var o = ko.mapping.toJS(self);
                ko.utils.arrayForEach(SubCase.transforms, function (transform) {
                    if (transform.hasOwnProperty('write')) {
                        transform.write(o, self);
                    }
                });
                return o;
            }
        };
        self.moduleCaseTypes = o.moduleCaseTypes;
        self.caseTypes = [];
        var caseTypeSet = {};
        for (var i = 0; i < self.moduleCaseTypes.length; i++) {
            var case_type = self.moduleCaseTypes[i].case_type;
            if (!caseTypeSet.hasOwnProperty(case_type)) {
                caseTypeSet[case_type] = true;
                self.caseTypes.push(case_type);
            }
        }

        self.getCaseTypeLabel = function (caseType) {
            var module_names = [], label;
            for (var i = 0; i < self.moduleCaseTypes.length; i++) {
                if (self.moduleCaseTypes[i].case_type === caseType) {
                    module_names.push(self.moduleCaseTypes[i].module_name);
                }
            }
            label = module_names.join(', ');
            if (caseType == self.utils.caseType) {
                label = '*' + label;
            }
            return label
        };
        self.subcases = ko.observableArray(ko.utils.arrayMap(o.actions.subcases, SubCase.wrap));
        self.addSubCase = function () {
            self.subcases.push(SubCase.wrap({}));
        };
        self.removeSubCase = function (subcase) {
            self.subcases.remove(subcase);
            self.utils.change();
        };
        self.toJS = ko.computed(function () {
            return ko.utils.arrayMap(self.subcases(), SubCase.unwrap);
        });
        self.toJS.subscribe(function (newValue) {
            self.utils.actions.subcases = newValue;
        });
        // Call on load
        self.utils.actions.subcases = self.toJS();
    }
    SubCasesViewModel.prototype.getLabel = function (question) {
        return CaseConfig.prototype.truncateLabel((question.repeat ? '- ' : '') + question.label, question.tag == 'hidden' ? ' (Hidden)' : '');
    };
    var action_names = ["open_case", "update_case", "close_case", "case_preload"],
        CaseConfig = function (params) {
            var i, $form,
                ejs_urls = params.ejs_urls;

            this.home = params.home;
            this.actions = (function (a) {
                var actions = {}, i;
                for (i = 0; i < action_names.length; i += 1) {
                    actions[action_names[i]] = a[action_names[i]];
                }
                actions.subcases = a.subcases;
                return actions;
            }(params.actions));
            this.questions = params.questions;
            this.edit = params.edit;
            this.save_url = params.save_url;
            // `requires` in a ko observable so it can be read by another UI
            this.requires = params.requires;
            this.save_requires_url = params.save_requires_url;
            this.caseType = params.caseType;

            function makeEJS(url) {
                return new EJS({
                    url: url,
                    type: "["
                });
            }
            for (var slug in ejs_urls) {
                if (ejs_urls.hasOwnProperty(slug) && slug !== 'action_templates') {
                    this[slug] = makeEJS(ejs_urls[slug]);
                }
            }
            this.action_templates = {};
            this.reserved_words = params.reserved_words;
            for (i = 0; i < action_names.length; i += 1) {
                this.action_templates[action_names[i]] = makeEJS(
                    ejs_urls.action_templates[action_names[i]]
                );
            }
            //        $("#casexml-template").remove();
            $form = $('<form method="POST"/>').attr('action', this.save_url).append(
                $('<textarea id="casexml_json" class="hidden" name="actions"/>')
            );

            this.saveButton = COMMCAREHQ.SaveButton.initForm($form, {
                unsavedMessage: "You have unchanged case settings",
                success: function (data) {
                    COMMCAREHQ.app_manager.updateDOM(data.update);
                }
            });
            $form.prependTo(this.home);
            this.subhome = $('<div/>').prependTo($form);
            if (this.edit) {
                this.saveButton.ui.prependTo(this.home);
            }

            var questionMap = {};
            _(this.questions).each(function (question) {
                questionMap[question.value] = question;
            });
            this.get_repeat_context = function(path) {
                if (path) {
                    return questionMap[path].repeat;
                } else {
                    return undefined;
                }
            };

            var questionScores = {};
            _(this.questions).each(function (question, i) {
                questionScores[question.value] = i;
            });
            this.questionScores = questionScores;

            ko.applyBindings(new SubCasesViewModel(params, this), $('#case-config-ko').get(0));
        };
    CaseConfig.prototype = {
        truncateLabel: function (label, suffix) {
            suffix = suffix || "";
            var MAXLEN = 40,
                maxlen = MAXLEN - suffix.length;
            return ((label.length <= maxlen) ? (label) : (label.slice(0, maxlen) + "...")) + suffix;
        },
        escapeQuotes: function (string) {
            return string.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        },
        action_is_active: function (action) {
            return action && action.condition && (action.condition.type === "if" || action.condition.type === "always");
        }
    };

    CaseConfig.prototype.render = function () {
        var i;
        for (i = 0; i < action_names.length; i += 1) {
            this.actions[action_names[i]] = this.actions[action_names[i]] || {
                condition: {
                    type: "never"
                }
            };
        }
        this.template.update(this.subhome.get(0), this);
        COMMCAREHQ.initBlock(this.subhome);
        $('.action-checkbox').each(function () {
            var container = $(this).parent().next('.well');
            if (!$(this).is(':checked')) {
                container.hide();
            }
        });
    };
    CaseConfig.prototype.change = function () {
        var casexml = this;
        $("#casexml_json").text(JSON.stringify(casexml.actions));
        casexml.saveButton.fire('change');
    };
    CaseConfig.prototype.init = function () {
        var casexml = this;
        if (this.questions.length && this.edit) {
            this.home.delegate('input:not(.action-checkbox), select', 'change textchange', function () {
                // recompute casexml_json
                casexml.refreshActions();
                casexml.render();
                casexml.refreshActions();
                casexml.render();
                casexml.change();
            }).delegate('input.action-checkbox', 'change', function () {
                var container = $(this).parent().next('.well');
                if ($(this).is(':checked')) {
                    container.slideDown();
                } else {
                    container.slideUp();
                }
                casexml.refreshActions();
                casexml.change();
            });
        }
        this.render();
    };
    CaseConfig.prototype.sortByQuestions = function (map, keysOrValues) {
        var self = this, pairs = _.pairs(map);
        return _(pairs).sortBy(function (pair) {
            var path = keysOrValues === 'keys' ? pair[0] : pair[1];
            return self.questionScores[path];
        });
    };
    CaseConfig.prototype.renderCondition = function (condition) {
        return this.condition_ejs.render({
            casexml: this,
            condition: condition
        });
    };
    CaseConfig.prototype.getQuestions = function (filter, excludeHidden, includeRepeat) {
        // filter can be "all", or any of "select1", "select", or "input" separated by spaces
        var i, options = [],
            q;
        excludeHidden = excludeHidden || false;
        includeRepeat = includeRepeat || false;
        filter = filter.split(" ");
        if (!excludeHidden) {
            filter.push('hidden');
        }
        for (i = 0; i < this.questions.length; i += 1) {
            q = this.questions[i];
            if (filter[0] === "all" || filter.indexOf(q.tag) !== -1) {
                if (includeRepeat || !q.repeat) {
                    options.push(q);
                }
            }
        }
        return options;
    };
    CaseConfig.prototype.renderOptions = function (options, value, name, allowNull) {
        if (allowNull === undefined) {
            allowNull = true;
        }
        return this.options_ejs.render({
            casexml: this,
            options: options,
            value: value,
            name: name,
            allowNull: allowNull
        });
    };
    CaseConfig.prototype.renderQuestions = function (filter) {
        var options = this.getQuestions(filter),
            html = "";
        options.forEach(function (o) {
            html += "<option value='" + o.value + "' title='" + this.escapeQuotes(o.label) + "'>" + this.truncateLabel(o.label) + "</option>";
        });
        return html;
    };
    CaseConfig.prototype.getAnswers = function (condition) {
        var i, q, o, value = condition.question,
            found = false,
            options = [];
        for (i = 0; i < this.questions.length; i += 1) {
            q = this.questions[i];
            if (q.value === value) {
                found = true;
                break;
            }
        }
        if (found && q.options) {
            for (i = 0; i < q.options.length; i += 1) {
                o = q.options[i];
                options.push(o);
            }
        }
        return options;
    };
    CaseConfig.prototype.renderChecked = function (action) {
        if (this.action_is_active(action)) {
            return 'checked="true"';
        } else {
            return "";
        }
    };

    CaseConfig.prototype.refreshActions = function () {
        var actions = this.actions,
            requires;

        function lookup(root, key) {
            return $(root).find('[name="' + key + '"]').attr('value');
        }
        requires = $('[name="requires"]', this.subhome).val();
        if (requires !== this.requires()) {
            this.requires(requires);
            this.render();
        }
        $(".casexml .action").each(function () {

            var $checkbox = $(this).find('input[type="checkbox"].action-checkbox'),
                id = $checkbox.attr('id').replace('-', '_'),
                action = {
                    "condition": {
                        "type": "never"
                    }
                };

            if (!$checkbox.is(":checked")) {
                actions[id] = action;
                return;
            }


            if (id === "open_case") {
                action.name_path = lookup(this, 'name_path');
                action.external_id = lookup(this, 'external_id');
            } else if (id === "update_case") {
                action.update = {};
                $('.action-update', this).each(function () {
                    var key = lookup(this, "action-update-key"),
                        val = lookup(this, "action-update-value");
                    if (key || val) {
                        action.update[key] = val;
                    }
                });
            } else if (id === "case_preload") {
                action.preload = {};
                $('.action-update', this).each(function () {
                    var propertyName = lookup(this, "action-update-key"),
                        nodeset = lookup(this, "action-update-value");
                    if (propertyName || nodeset) {
                        action.preload[nodeset] = propertyName;
                    }
                });
            }
            action.condition = {
                'type': 'always'
            }; // default value
            $('.condition', this).each(function () { // there is only one
                // action.condition = {};
                //                if($checkbox.is(":checked")) {
                //                    action.condition.type = "never";
                //                }
                if ($('input[name="if"]', this).is(':checked')) {
                    action.condition.type = "if";
                } else {
                    action.condition.type = 'always';
                }
                if (action.condition.type === 'if') {
                    action.condition.question = lookup(this, 'condition-question');
                    action.condition.answer = lookup(this, 'condition-answer');
                }
            });
            actions[id] = action;

        });
    };

    CaseConfig.prototype.renderAction = function (action_type, label) {
        var html = this.action_ejs.render({
            casexml: this,
            id: action_type.replace("_", "-"),
            action_type: action_type,
            label: label,
            action_body: this.action_templates[action_type].render(this)
        });
        return html;
    };
    CaseConfig.prototype.hasActions = function () {
        var a;
        for (a in this.actions) {
            if (this.actions.hasOwnProperty(a)) {
                if (this.action_is_active(this.actions[a])) {
                    return true;
                }
            }
        }
    };

    CaseConfig.prototype.renderPropertyList = function (map, keyType, reservedWords, showSuggestion) {
        showSuggestion = showSuggestion === undefined ? false : showSuggestion;
        return this.propertyList_ejs.render({
            map: map,
            keyType: keyType,
            showSuggestion: showSuggestion,
            casexml: this,
            reservedWords: reservedWords
        });
    };

    return {CaseConfig: CaseConfig};
}());