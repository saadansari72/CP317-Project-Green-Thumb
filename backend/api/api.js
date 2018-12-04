/**
 * Module: api.js
 * ------------------------------------------------------------------
 * Authors: Nathaniel Carr, Aaron Exley, Adam Cassidy
 * ------------------------------------------------------------------
 * Last Update: 2018/11/17
 * -------------------------------------------------------------------
 * Description:
 * Runs backend API.
 * -------------------------------------------------------------------
 * References:
 * - express.js docs: https://expressjs.com/en/4x/api.html
 */

// Imports.
const Admin = require("../Admin.js");
const Ban = require("../Ban.js");
const Photo = require("../Photo.js");
const PhotoReport = require("../PhotoReport.js");
const Plant = require("../Plant.js");
const User = require("../User.js");
const DBInterface = require("../db/DBInterface.js");
const MLIdentifier = require("../machineLearning/MLIdentifier.js");
const MLTrainer = require("../machineLearning/MLTrainer.js");

// Constants.
const assert = require("assert");
const API_PORT = 2500;
const DEFAULTS = {
    plantsMaxPhotos: 3,
};
const STUB_HELPER = {
    images: [
        "https://www.catster.com/wp-content/uploads/2017/12/A-gray-kitten-meowing.jpg",
        "https://d3pz1jifuab5zg.cloudfront.net/2015/09/04194922/kitten-walking-150904.jpg",
        "https://www.dejohnpetservices.com/wp-content/uploads/cats-animals-kittens-background.jpg",
        "https://www.petwave.com/-/media/Images/Center/Care-and-Nutrition/Cat/Kittensv2/Kitten-2.ashx?w=450&hash=1D0CFABF4758BB624425C9102B8209CCF8233880",
        "http://static1.squarespace.com/static/54e8ba93e4b07c3f655b452e/589b53f917bffcb8cefc8eef/5ab090f48a922d6ee3b9b805/1523848316782/Kitten.jpg?format=1000w",
        "https://www.puppyleaks.com/wp-content/uploads/2017/09/puppysmile.png",
        "https://www.petmd.com/sites/default/files/petmd-shaking-puppy.jpg",
        "https://images.mentalfloss.com/sites/default/files/styles/mf_image_16x9/public/istock-598825938.png?itok=yAcHEsp2&resize=1100x1100",
        "http://2.bp.blogspot.com/-RUkL7sMWo5I/TaYPRpEbM-I/AAAAAAAAKNk/LIqHQwGZyJc/s1600/cutest%2Bpuppy.jpg",
        "https://cdn2-www.dogtime.com/assets/uploads/2015/05/file_21702_impossibly-cute-puppy-30.jpg",
        "http://eskipaper.com/images/small-cute-bunny-1.jpg",
        "http://www.cutestpaw.com/wp-content/uploads/2015/05/Cute-a-bunny.jpg",
        "https://netherlanddwarfbunny.com/wp-content/uploads/2017/09/netherland-dwarf-bunny-cute-and-irresistible.jpg",
        "https://specieslove.files.wordpress.com/2011/08/owl_duck1.jpg",
    ],
    randImage: () => { // select random image.
        return STUB_HELPER.images[parseInt((Math.random() * (STUB_HELPER.images.length)))];
    },
    randVoteArr: (up) => { // generate random vote array.
        let arr = [];
        let num = parseInt(Math.random() * 100);
        for (let i = 0; i < num; i++) {
            arr[arr.length] = parseInt(parseInt(Math.random() * 10000)) * 2 + (up ? 1 : 0);
        }
        return arr.sort((a, b) => a - b);
    },
    reportText: [
        "delet this.",
        "ANGERY.",
        "Sample text.",
        "WAHHHH!!!"
    ],
    randReportText: () => {
        return STUB_HELPER.reportText[parseInt((Math.random() * (STUB_HELPER.reportText.length)))]
    },
    plantBios: [
        "According to all known laws of aviation, there is no way a bee should be able to fly. Its wings are too small to get its fat little body off the ground. The bee, of course, flies anyway because bees don't care what humans think is impossible. Yellow, black. Yellow, black. Yellow, black. Yellow, black. Ooh, black and yellow! Let's shake it up a little. Barry! Breakfast is ready! Ooming! Hang on a second. Hello? - Barry? - Adam? - Oan you believe this is happening? - I can't. I'll pick you up. Looking sharp. Use the stairs. Your father paid good money for those. Sorry. I'm excited. Here's the graduate. We're very proud of you, son. A perfect report card, all B's. Very proud. Ma! I got a thing going here. - You got lint on your fuzz. - Ow! That's me! - Wave to us! We'll be in row 118,000. - Bye! Barry, I told you, stop flying in the house! - Hey, Adam. - Hey, Barry...",
        "What do you get if you divide the circumference of a pumpkin by its diameter? / Pumpkin pi.",
        "What do you call a stolen yam? / A hot potato.",
        '"Bulb: potential flower buried in Autumn, never to be seen again." -  Henry Beard',
        '"I have a rock garden.  Last week three of them died." -  Richard Diran'
    ],
    randPlantBio: () => {
        return STUB_HELPER.plantBios[parseInt(Math.random() * (STUB_HELPER.plantBios.length))];
    }
};
const ERROR_MSG = {
    missingParam: (param) => { return `Missing required '${param}' parameter in request body.`; },
    missingObject: (param) => { return `The requested ${param} object could not be found in the database.`; },
    invalidParam: (param) => { return `Parameter '${param}' is invalid.`; },
    unauthorized: () => { return `User is not authorized to perform this action.`; },
    missingText: (param) => { return `Parameter '${param}' must be a non-empty String.`; },
    noNeg: (param) => { return `Parameter '${param}' may not be negative.`; },
    noPos: (param) => { return `Parameter '${param}' may not be positive.`; },
    onlyNeg: (param) => { return `Parameter '${param}' must be negative.`; },
    onlyPos: (param) => { return `Parameter '${param}' must be positive.`; },
};
const ERROR_CODE = {
    badRequest: 400,
    unauthorized: 401,
    internalError: 500
};

// Create API.
const express = require("express");
const api = express();

// Use middleware to properly parse incoming requests.
api.use(express.json());
api.use(express.urlencoded({ extended: true }));

/**
 * @desc Check the existence and validity of the parameters in the request body.
 * @author Nathaniel Carr
 * @param {*} body The request body.
 * @param {function(body)} checkFunc A function containing assert statements and the appropriate error messages.
 * @returns {boolean} True iff all params were validated.
 */
function validateParams(req, res, checkFunc) {
    try {
        if (req.body !== undefined && checkFunc !== undefined) {
            checkFunc(req.body);
        }
        return true;
    } catch (err) {
        if (err instanceof (assert.AssertionError)) { // If an internal error, don't say it was a bad request.
            res.send(ERROR_CODE.badRequest, err.message ? { message: err.message } : null);
        } else {
            res.send(ERROR_CODE.internalError);
            console.error(err.message);
        }
        return false;
    }
}

/**
 * @author Nathaniel Carr
 * @author Noah Nichols
 * @desc Add and return the submitted Photo to the database.
 */
api.post("/photos/add", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.userId !== undefined, ERROR_MSG.missingParam("userId"));
            assert(body.plantId !== undefined, ERROR_MSG.missingParam("plantId"));
            assert(body.image !== undefined, ERROR_MSG.missingParam("image"));
            assert(body.userId >= 0, ERROR_MSG.noNeg("userId"));
            assert(body.plantId >= 0, ERROR_MSG.noNeg("plantId"));
        })) { return; }
        let photo = await DBInterface.addPhoto(new Photo(body.id, body.plantId,body.userId,body.image,body.uploadDate,body.upvoteIds, body.downvoteIds));

        res.send({
            
            photo: photo.toJSON()
            }
        );
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Noah Nichols
 * 
 * @desc Return the Photo with the corresponding ID from the database.
 */
api.post("/photos/byId", (req, res) => {
    try {
        let photo = await DBInterface.getPhoto(req.body.photoId);
        res.send({
            photo: photo.toJSON()
            
        });
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
        return;
    }
});

/**
 * @author Nathaniel Carr
 * @author Noah Nichols
 * @desc Return the requested number of Photos (desc. sorted by date) from the database, including options for Photos from a specific User or Photos of a specifid Plant.
 */
api.post("/photos/list/byDate", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.startIndex !== undefined, ERROR_MSG.missingParam("startIndex"));
            assert(body.max !== undefined, ERROR_MSG.missingParam("max"));
            assert(body.startIndex >= 0, ERROR_MSG.noNeg("startIndex"));
            assert(body.max > 0, ERROR_MSG.onlyPos("max"));
            assert(req.body.userId !== undefined || req.body.plantId !== undefined);
        })) { return; }
        
        let photos = [];
        let jsonPhotos = [];
            if(body.userId !== undefined){
                photos = await DBInterface.getNewestUserPhotos(req.body.userId, req.body.startIndex, req.body.max);

            }else if(body.plantId !== undefined){
                photos = await DBInterface.getNewestPlantPhotos(req.body.plantId, req.body.startIndex, req.body.max);
            }else{
                photos = await DBInterface.getNewestPlant
            }
        
        
        photos.sort((a, b) => { return b.uploadDate.getTime() - a.uploadDate.getTime(); });
        for(let j = req.body.startIndex; j < body.max; j++){
            jsonPhotos[j] = photos[j].toJSON();
        }
        res.send({
            photos: jsonPhotos
        });
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Noah Nichols
 * @desc Return the requested number of Photos (desc. sorted by rating) from the database, including options for Photos from a specific User or Photos of a specifid Plant.
 */
api.post("/photos/list/byRating", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.startIndex !== undefined, ERROR_MSG.missingParam("startIndex"));
            assert(body.max !== undefined, ERROR_MSG.missingParam("max"));
            assert(body.startIndex >= 0, ERROR_MSG.noNeg("startIndex"));
            assert(body.max > 0, ERROR_MSG.onlyPos("max"));
        })) { return; }

        let photos = [];
        let jsonPhotos = [];
        if(body.userId !== undefined){
            photos = await DBInterface.getTopUserPhotos(req.body.userId, req.body.startIndex, req.body.max);
        }else if(body.plantId !== undefined){
            photos = await DBInterface.getTopPlantPhotos(req.body.plantId, req.body.startIndex, req.body.max);
        }else{
            photos = await DBInterface.getTopPhotos(req.body.startIndex, req.body.max);
        }
            
        
        photos.sort((a, b) => { return (a.upvoteIds.length - a.downvoteIds.length) - (b.upvoteIds.length - b.downvoteIds.length); });
        for(let j = req.body.startindex; j < req.body.max; j++){
            jsonPhotos[j] = photos[j].toJSON();
        }
        res.send({
            photos: jsonPhotos
        });
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Noah Nichols
 * @desc Remove the Photo with the corresponding ID from the database.
 */
api.post("/photos/remove", (req, res) => {
    try {
        await DBInterface.removePhoto(req.body.photoId);
        res.send({});
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});


/**
 * @author Nathaniel Carr
 * @author Scott Peebles
 * @desc Add and return the submitted PhotoReport to the database.
 */
api.post("/photoReports/add", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.userId !== undefined, ERROR_MSG.missingParam("userId"));
            assert(body.photoId !== undefined, ERROR_MSG.missingParam("photoId"));
            assert(body.reportText !== undefined, ERROR_MSG.missingParam("reportText"));
            assert(body.userId >= 0, ERROR_MSG.noNeg("userId"));
            assert(body.photoId >= 0, ERROR_MSG.noNeg("photoId"));
            
        })) { return; }
	
		
		photoReport: {
                id: parseInt(Math.random() * 2),
                adminAction: undefined,
                adminId: undefined,
                userId: req.body.userId,
                reportText: req.body.reportText,
                handleDate: undefined,
                reportDate: new Date()
            }
		
		let report = await DBInterface.addPhotoReport(new Photoreport(photoReport));
		
		
		

        res.send({
        
		report: report.toJSON();
       
        });
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Scott Peebles
 * @desc Return the PhotoReport with the corresponding ID from the database.
 */
api.post("/photoReports/byId", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.photoReportId !== undefined, ERROR_MSG.missingParam("photoReportId"));
            assert(body.photoReportId >= 0, ERROR_MSG.noNeg("photoReportId"));
            
        })) { return; }
			let report = await DBInterface.getPhotoReport(req.body.photoReportID);
		
		res.send({
		report: report.toJSON()});
		
	
     catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
		
		return;
    }
});

/**
 * @author Nathaniel Carr
 * @author Scott Peebles
 * @desc Handle the PhotoReport with the corresponding ID.
 */
api.post("/photoReports/handle", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.photoReportId !== undefined, ERROR_MSG.missingParam("photoReportId"));
            assert(body.adminAction !== undefined, ERROR_MSG.missingParam("adminAction"));
            assert(body.adminAction >= 0, ERROR_MSG.noNeg("adminAction"));
            assert(body.adminAction >= 0 && req.body.adminAction <= 2, ERROR_MSG.invalidParam("adminAction"));
            
        })) { return; }

		
		let userID = photoReport.getUserID();
		let expirationDate = undefined;
		
		if(body.adminAction == 0){DBInterface.removePhotoReport(req.body.photoReportId);}
		else if(body.adminAction == 1){DBInterface.removePhoto(photoReport.getPhotoID());}
		else if (body.adminAction == 2){DBInterface.removePhoto(photoReport.getPhotoID()), Ban(parseInt(Math.random() * 10000), userID, req.body.adminId, expirationDate);
			
		
		
		
		

        res.send({});
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Scott Peebles
 * @desc Return the requested number of PhotoReports (asc. sorted by date) from the database, including options for PhotoReports judged by a specific Admin or unhandled PhotoReports.
 */
api.post("/photoReports/list/byDate", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.startIndex !== undefined, ERROR_MSG.missingParam("startIndex"));
            assert(body.max !== undefined, ERROR_MSG.missingParam("max"));
            assert(body.adminId >= 0, ERROR_MSG.noNeg("adminId"));
            assert(body.handledBy === undefined || body.handledBy >= 0, ERROR_MSG.noNeg("handledBy"));
            assert(body.startIndex >= 0, ERROR_MSG.noNeg("startIndex"));
            assert(body.max > 0, ERROR_MSG.onlyPos("max"));
            assert(!(body.handledBy !== undefined && body.unhandledOnly === true), `Parameter 'unhandledOnly' must be false if parameter 'handledBy' is not undefined.`);
            
        })) { return; }

        let photoReports = [];
        let jsonPhotoReports = [];
         
		photoReports = await DBInterface.getUnhandledPhotoReportsByDate(req.body.startIndex, req.body.max);
            
        
		
		
		for(let i = req.body.startIndex; i < req.body.max; i++){
            jsonPhotoReports[i] = photoReports[i].toJSON();
        }
        res.send({
            photoReports: jsonPhotoReports
        });
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Scott Peebles
 * @desc Remove the PhotoReport with the corresponding ID from the database.
 */
api.post("/photoReports/remove", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.photoReportId !== undefined, ERROR_MSG.missingParam("photoReportId"));
            assert(body.photoReportId >= 0, ERROR_MSG.noNeg("photoReportId"));
            
        })) { return ;}

		await DBInterface.removePhotoReport(req.body.photoReportId);
		res.send({});
		
     catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});
	
/**
 * @author Nathaniel Carr
 * @desc Add and return the submitted Plant to the database.
 */
api.post("/plants/add", async (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.adminId !== undefined, ERROR_MSG.missingParam("adminId"));
            assert(body.name !== undefined, ERROR_MSG.missingParam("name"));
            assert(body.bio !== undefined, ERROR_MSG.missingParam("bio"));
            assert(body.name !== "", ERROR_MSG.missingText("name"));
            assert(body.bio !== "", ERROR_MSG.missingText("bio"));
            assert(DBInterface.checkAdmin(body.adminId), ERROR_MSG.unauthorized());
        })) { return; }

        let plant = await DBInterface.addPlant(new Plant(body.name, body.bio));
        let photos = await DBInterface.getTopPlantPhotos(plant.getId());
        for (let i = 0; i < photos.length; i++) {
            photos[i] = photos[i].toJSON();
        }

        res.send({
            plant: plant.toJSON(),
            photos: photos
        });

    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @desc Return the Plant with the corresponding ID from the database.
 */
api.post("/plants/byId", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.plantId !== undefined, ERROR_MSG.missingParam("plantId"));
            assert(body.maxPhotos === undefined || body.maxPhotos >= 0), ERROR_MSG.noNeg("maxPhotos");
            // TODO check that the plantId is valid.
        })) { return; }

        req.body.maxPhotos = req.body.maxPhotos !== undefined ? req.body.maxPhotos : DEFAULTS.plantsMaxPhotos;

        let plant = await DBInterface.getPlant(req.body.plantId);
        let photos = await DBInterface.getTopPlantPhotos(plant.getId());
        for (let i = 0; i < photos.length; i++) {
            photos[i] = photos[i].toJSON();
        }

        res.send({
            plant: plant.toJSON(),
            photos: photos
        });

    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Aaron Exley
 * @desc Return the Plants that best match the included image.
 * 
 * @returns return results in the form
 *          results [
 *              { 
 *                  plant: Plant,
 *                  photos: Photos[3],
 *                  score: float,
 *                  topLeft: {x, y},
 *                  bottomRight: {x, y}
 *              }
 *          ]
 */
api.post("/plants/byImage", async (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.image !== undefined, ERROR_MSG.missingParam("image"));
            assert(body.maxPhotos === undefined || body.maxPhotos >= 0), ERROR_MSG.noNeg("maxPhotos");
            // TODO: check that image is valid.
        })) { return; }

        req.body.maxPhotos = req.body.maxPhotos !== undefined ? req.body.maxPhotos : DEFAULTS.plantsMaxPhotos;

        let TFResults = MLIdentifier.predict(req.body.image);

        let results = [];
        for (let i = 0; i < TFResults.numResults; i++) {
            let plant = await DBInterface.getPlant(TFResults.classes[i]);
            let photos = await DBInterface.getTopPlantPhotos(plant.getId(), 0, req.body.maxPhotos);
            for (let j = 0; j < photos.length; j++) {
                photos[j] = photos[j].toJSON();
            }

            // TODO: Verify that req.body.image has a height and width property
            let min_y = TFResults.boxes[i * 4] * req.body.image.height;
            let min_x = TFResults.boxes[i * 4 + 1] * req.body.image.width
            let max_y = TFResults.boxes[i * 4 + 2] * req.body.image.height;
            let max_x = TFResults.boxes[i * 4 + 3] * req.body.image.width;

            results.push({
                plant: plant,
                photos: photos,
                score: TFResults.scores[i],
                topLeft: {
                    x: min_x,
                    y: min_y
                },
                bottomRight: {
                    x: max_x,
                    y: max_y
                }
            });
        }

        res.send({ results: results });

    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @desc Return the Plants that best match the included query.
 */
api.post("/plants/byQuery", async (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.query !== undefined, ERROR_MSG.missingParam("query"));
            assert(body.query !== "", ERROR_MSG.missingText("query"));
            assert(body.maxPhotos === undefined || body.maxPhotos >= 0), ERROR_MSG.noNeg("maxPhotos");
        })) { return; }

        req.body.maxPhotos = req.body.maxPhotos !== undefined ? req.body.maxPhotos : DEFAULTS.plantsMaxPhotos;

        let plants = DBInterface.getPlantsByQuery(body.query);
        let results = [];
        for (let i = 0; i < plants.length; i++) {
            let photos = await DBInterface.getTopPlantPhotos(plants[i].getId(), 0, req.body.maxPhotos);
            for (let j = 0; j < photos.length; j++) {
                photos[i] = photos[i].toJSON();
            }
            results.push({
                plant: plants[i].toJSON(),
                photos: photos
            })
        }

        return results;

    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @desc Remove the Plant with the corresponding ID from the database.
 */
api.post("/plants/remove", async (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.adminId !== undefined, ERROR_MSG.missingParam("adminId"));
            assert(body.plantId !== undefined, ERROR_MSG.missingParam("plantId"));
            assert(DBInterface.checkAdmin(body.adminId), ERROR_MSG.unauthorized());
        })) { return; }

        await DBInterface.removePlant(req.body.plantId);
        res.send({});

    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @desc Update the Plant with the corresponding ID.
 */
api.post("/plants/update", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.adminId !== undefined, ERROR_MSG.missingParam("adminId"));
            assert(body.plantId !== undefined, ERROR_MSG.missingParam("plantId"));
            assert(body.bio !== undefined, ERROR_MSG.missingParam("bio"));
            assert(body.bio !== "", ERROR_MSG.missingText("bio"));
            assert(DBInterface.checkAdmin(body.adminId), ERROR_MSG.unauthorized());
        })) { return; }

        let plant = await DBInterface.getPlant(req.body.plantId);

        plant.setBio(req.body.bio);

        res.send({
            plant: await DBInterface.updatePlant(plant)
        });

    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @desc Retrain the machine learning model immediately.
 */
api.post("/mlModel/training/immediate", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.adminId !== undefined, ERROR_MSG.missingParam("adminId"));
            assert(DBInterface.checkAdmin(body.adminId), ERROR_MSG.unauthorized());
        })) { return; }

        MLTrainer.retrain();

        res.send({});

    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Adam Cassidy
 * @desc Add and return the submitted User to the database.
 */
api.post("/users/add", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.userId !== undefined, ERROR_MSG.missingParam("userId"));
	    assert(Number(body.userId), ERROR_MSG.invalidParam("userId"));
            assert(body.userId >= 0, ERROR_MSG.noNeg("userId"));
            // TODO check that no user with the given userId exists.
        })) { return; }
        
        let currUser = new User(req.body.userId);
        DBInterface.addUser(currUser);
        
        res.send({
            user: {
                admin: false,
                bans: [],
                id: req.body.userId
            }
        });
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Adam Cassidy
 * @desc Add a new ban to the User with the corresponding ID.
 */
api.post("/users/ban", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.adminId !== undefined, ERROR_MSG.missingParam("adminId"));
            assert(body.userId !== undefined, ERROR_MSG.missingParam("userId"));
	    assert(Number(body.userId), ERROR_MSG.invalidParam("userId"));
            assert(Number(body.adminId), ERROR_MSG.invalidParam("adminId"));
            assert(body.adminId >= 0, ERROR_MSG.noNeg("adminId"));
            assert(body.userId >= 0, ERROR_MSG.noNeg("userId"));
            // TODO check that the adminId belongs to an admin.
            // TODO check that the userId is valid.
        })) { return; }
        
        
        let currUser = DBInterface.getUser(req.body.userId);
        currUser.ban(req.body.adminId);
        //adds the last ban in the user's Ban[] to the database.
        DBInterface.addBan(currUser.getBans()[-1]);

        res.send({});
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Adam Cassidy
 * @desc Return the User with the corresponding ID from the database.
 */
api.post("/users/byId", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.userId !== undefined, ERROR_MSG.missingParam("userId"));
	    assert(Number(body.userId), ERROR_MSG.invalidParam("userId"));
            assert(body.userId >= 0, ERROR_MSG.noNeg("userId"));
            // TODO check that the userId is valid.
        })) { return; }

        
        let currUser = DBInterface.getUser(req.body.userId);

        res.send({
            user: {
                admin: (currUser instanceof Admin),
                bans: currUser.getBans(),
                id: req.body.userId
            }
        });
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Adam Cassidy
 * @desc Make the User with the corresponding ID an Admin in the database.
 */
api.post("/users/makeAdmin", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.adminId !== undefined, ERROR_MSG.missingParam("adminId"));
            assert(body.userId !== undefined, ERROR_MSG.missingParam("userId"));
	    assert(Number(body.userId), ERROR_MSG.invalidParam("userId"));
            assert(Number(body.adminId), ERROR_MSG.invalidParam("adminId"));
            assert(body.adminId >= 0, ERROR_MSG.noNeg("adminId"));
            assert(body.userId >= 0, ERROR_MSG.noNeg("userId"));
            // TODO check that the adminId belongs to an admin.
            // TODO check that the userId is valid.
        })) { return; }

        let currUser = DBInterface.getUser(req.body.userId);
        currUser = new Admin(req.body.userId, DBInterface.getUser(req.body.userId).getBans());
        DBInterface.addAdmin(currUser);
      
        res.send({});
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

/**
 * @author Nathaniel Carr
 * @author Adam Cassidy
 * @desc Remove the User with the corresponding ID from the database.
 */
api.post("/users/remove", (req, res) => {
    try {
        if (!validateParams(req, res, (body) => {
            assert(body.adminId !== undefined, ERROR_MSG.missingParam("adminId"));
            assert(body.userId !== undefined, ERROR_MSG.missingParam("userId"));
	    assert(Number(body.userId), ERROR_MSG.invalidParam("userId"));
            assert(Number(body.adminId), ERROR_MSG.invalidParam("adminId"));
            assert(body.adminId >= 0, ERROR_MSG.noNeg("adminId"));
            assert(body.userId >= 0, ERROR_MSG.noNeg("userId"));
            // TODO check that the adminId belongs to an admin.
            // TODO check that the userId is valid.
        })) { return; }
        
        DBInterface.removeUser(req.body.userId);

        res.send({});
    } catch (err) {
        res.send(ERROR_CODE.internalError);
        console.error(err.message);
    }
});

// Start running the API.
api.listen(API_PORT, () => {
    console.log(`GreenThumb API listening on port ${API_PORT}`);
});