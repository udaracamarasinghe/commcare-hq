/*
    To use, include this file on a page that also includes hqwebapp/rollout_modal.html
*/
hqDefine("hqwebapp/js/rollout_modal", function() {
    var _trackSoftRollout = hqImport('analytix/js/google').trackCategory("Soft Rollout");

    function snooze(slug) {
        $.cookie(cookieName(slug), true, { expires: 3, path: '/' });
        _trackSoftRollout.event("snooze", slug);
        hqImport('analytix/js/kissmetrics').track.event("Soft Rollout snooze " + slug);
    }

    function cookieName(slug) {
        return "snooze_" + slug;
    }

    $(function() {
        var alert_user = hqImport("hqwebapp/js/alert_user").alert_user,
            $modal = $("#rollout-modal"),
            slug = $modal.data("slug");

        if ($modal.length && (!$.cookie(cookieName(slug)) || $modal.data("force"))) {
            // Show modal on page load
            $modal.modal({
                backdrop: 'static',
                keyboard: false,
                show: true,
            });
        }

        // User clicks to turn on flag
        $modal.on('click', '.flag-enable', function() {
            $.post({
                url: hqImport("hqwebapp/js/initial_page_data").reverse("toggle_" + slug),
                data: {
                    on_or_off: "on",
                },
                success: function() {
                    window.location.reload(true);
                },
                error: function() {
                    $modal.modal('hide');
                    alert_user(gettext('We could not turn on the new feature. You will have the opportunity ' +
                                       'to turn it on the next time you visit this page.'), 'danger');
                },
            });
            _trackSoftRollout.event("enable", slug);
            hqImport('analytix/js/kissmetrics').track.event("Soft Rollout enable " + slug);
        });

        // User clicks to snooze
        $modal.on('click', '.flag-snooze', function() {
            $modal.modal('hide');
            snooze(slug);
        });

        $("#rollout-revert").click(function() {
            var slug = $(this).data("slug"),
                redirect = $(this).data("redirect");
            $.post({
                url: hqImport("hqwebapp/js/initial_page_data").reverse("toggle_" + slug),
                data: {
                    on_or_off: "off",
                },
                success: function(data) {
                    snooze(slug);
                    if (redirect) {
                        window.location = redirect;
                    } else {
                        window.location.reload(true);
                    }
                },
                error: function() {
                    alert_user(gettext('We could not turn off the new feature. Please try again later.'), 'danger');
                },
            });
            _trackSoftRollout.event("disable", slug);
            hqImport('analytix/js/kissmetrics').track.event("Soft Rollout disable " + slug);
        });
    });
});
