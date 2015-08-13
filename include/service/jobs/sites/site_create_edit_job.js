
//dependencies
var async = require('async');
var util  = require('../../../util.js');

module.exports = function SiteCreateEditJobModule(pb) {

    /**
     * Job to create/edit a site.
     * @constructor SiteCreateEditJob
     * @extends SiteJobRunner
     */
    function SiteCreateEditJob(){
        SiteCreateEditJob.super_.call(this);

        //initialize
        this.init();
        this.setParallelLimit(1);
    };
    util.inherits(SiteCreateEditJob, pb.SiteJobRunner);

    /**
     * Get tasks to create/edit a site.
     * @method getInitiatorTasks
     * @override
     * @param {Function} cb - callback function
     */
    SiteCreateEditJob.prototype.getInitiatorTasks = function(cb) {
        var self = this;

        var activateCommand = {};

        //progress function
        var tasks = [
            //create/edit site in mongo
            function(callback) {
                self.doPersistenceTasks(function(err, results) {
                    self.onUpdate(100 / tasks.length);
                    if (util.isError(err)) {
                        self.log(err.stack);
                    }
                    callback(err, results);
                });
            },

            //remove site to request handler site collection across cluster
            self.createCommandTask('create_edit_site', activateCommand)
        ];
        cb(null, tasks);
    };

    /**
     * Get task to stop accepting traffic for the site.
     * @method getWorkerTasks
     * @override
     * @param {Function} cb - callback
     */
    SiteCreateEditJob.prototype.getWorkerTasks = function(cb) {
        var self = this;
        var site = this.getSite();
        var tasks = [

            //allow traffic to start routing for site
            function(callback) {
                self.siteService.stopAcceptingSiteTraffic(site, callback);
            }
        ];
        cb(null, tasks);
    };

    /**
     * Update site to active as false in database to create/edit.
     * @method doPersistenceTasks
     * @param {Function} cb - callback
     */
    SiteCreateEditJob.prototype.doPersistenceTasks = function(cb) {
        var self = this;

        var mySite      = this.getSite();
        var tasks     = [
            //set site to active in mongo
            function(callback) {
                var dao = new pb.DAO();
                dao.loadByValue('uid', mySite.uid, 'site', function(err, site) {
                    if(util.isError(err)) {
                        return callback(err, null);
                    }

                    if (!site) {
                        return callback(new Error('Site not found'), null);
                    }

                    site.hostname = mySite.hostname || site.hostname;
                    site.displayName = mySite.displayName || site.displayName;

                    dao.save(site, function(err, result) {
                        if(util.isError(err)) {
                            return cb(err, null);
                        }

                        pb.RequestHandler.loadSite(site);
                        callback(err, result);
                    });
                });
            }
        ];
        async.series(tasks, function(err, results) {
            cb(err, !util.isError(err));
        });
    };

    //exports
    return SiteCreateEditJob;
};
