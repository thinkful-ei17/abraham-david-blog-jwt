'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const passport = require('passport');
const {Strategy: LocalStrategy} = require('passport-local');
const { DATABASE_URL, PORT } = require('./config');
const { BlogPost, UserModel} = require('./models');

const app = express();

app.use(morgan('common'));
app.use(bodyParser.json());


// Define localStrategy
const localStrategy = new LocalStrategy((username, password, done)=>{
    let givenUser;

    UserModel.findOne({username})
        .then(user=>{
            console.log('Answer me!!!! : ' + user);
            if(!user){
                return Promise.reject({
                    reason: 'LoginError',
                    message:'Incorrect username',
                    location: 'username'
                });
            }
            givenUser = user;
            /*
    1. Return Error if user is wrong
    2. Return error if pass is wrong
    3. return uer if goo
    */
            return user.validatePassword(password);

        })
        .then((isValid) => {
            console.log('Username: ' + username);
            console.log('Password: ' + password);
            console.log('Answer me: ' + isValid);

            //if isValid is false; then run this if statement
            //to do that !isValid aka !false because if statements need a true to run.
            if(!isValid){
                console.log('I ran! So far away!');
                return Promise.reject({
                    reason: 'LoginError',
                    message: 'Incorrect password',
                    location: 'password'
                });
            }
            return done(null, givenUser);
        })
        .catch(err => {
            // if(err.reason === 'LoginError'){
            //     return done(null, false);
            // }
            return done(err.message, false);
        });

});

passport.use(localStrategy);
const localAuth = passport.authenticate('local',{session: false});



app.post('/api/users', (req, res)=> {

    let {username, password, firstName, lastName} = req.body;

    return UserModel
        .find({username})
        .count()
        .then(count =>{
            if(count > 0){
                return Promise.reject({
                    code: 422,
                    reason: 'ValidationError',
                    message: 'Username already taken',
                    location: 'username'
                });
            }

            return UserModel.hashPassword(password);
        })
        .then((hashedPassword) => {
            return UserModel.create({username, password: hashedPassword, firstName, lastName});
        })
        .then(user => {
            return res.status(201).json(user.serialize());
        })
        .catch(err => {
            if(err.reason === 'ValidationError'){
                return res.status(err.code).json(err);
            }
            res.status(500).json({code: 500, message: err.message});
        });
});

app.post('/api/protected', localAuth, function(req, res){
    console.log('Got here!');
    res.json(req.user.serialize());
});


app.get('/posts', (req, res) => {
    BlogPost
        .find()
        .then(posts => {
            res.json(posts.map(post => post.serialize()));
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'something went terribly wrong' });
        });
});

app.get('/posts/:id', (req, res) => {
    BlogPost
        .findById(req.params.id)
        .then(post => res.json(post.serialize()))
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'something went horribly awry' });
        });
});

app.post('/posts', localAuth, (req, res) => {
    const requiredFields = ['title', 'content', 'author'];
    for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i];
        if (!(field in req.body)) {
            const message = `Missing \`${field}\` in request body`;
            console.error(message);
            return res.status(400).send(message);
        }
    }

    BlogPost
        .create({
            title: req.body.title,
            content: req.body.content,
            author: req.body.author
        })
        .then(blogPost => res.status(201).json(blogPost.serialize()))
        .catch(err => {
            console.log('woops?');
            console.error(err);
            res.status(500).json({ error: 'Something went wrong' });
        });

});


app.delete('/posts/:id', localAuth, (req, res) => {
    BlogPost
        .findByIdAndRemove(req.params.id)
        .then(() => {
            res.status(204).json({ message: 'success' });
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'something went terribly wrong' });
        });
});


app.put('/posts/:id', localAuth, (req, res) => {
    if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
        res.status(400).json({
            error: 'Request path id and request body id values must match'
        });
    }

    const updated = {};
    const updateableFields = ['title', 'content', 'author'];
    updateableFields.forEach(field => {
        if (field in req.body) {
            updated[field] = req.body[field];
        }
    });

    BlogPost
        .findByIdAndUpdate(req.params.id, { $set: updated }, { new: true })
        .then(updatedPost => res.status(204).end())
        .catch(err => res.status(500).json({ message: 'Something went wrong' }));
});



app.use('*', function (req, res) {
    res.status(404).json({ message: 'Not Found' });
});

// closeServer needs access to a server object, but that only
// gets created when `runServer` runs, so we declare `server` here
// and then assign a value to it in run
let server;

// this function connects to our database, then starts the server
function runServer(databaseUrl = DATABASE_URL, port = PORT) {
    return new Promise((resolve, reject) => {
        mongoose.connect(databaseUrl, { useMongoClient: true }, err => {
            if (err) {
                return reject(err);
            }
            server = app.listen( () => {
                console.log(`Your app is listening on port ${port}`);
                resolve();
            })
                .on('error', err => {
                    mongoose.disconnect();
                    reject(err);
                });
        });
    });
}

// this function closes the server, and returns a promise. we'll
// use it in our integration tests later.
function closeServer() {
    return mongoose.disconnect().then(() => {
        return new Promise((resolve, reject) => {
            console.log('Closing server');
            server.close(err => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    });
}

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
    runServer().catch(err => console.error(err));
}

module.exports = { runServer, app, closeServer };
