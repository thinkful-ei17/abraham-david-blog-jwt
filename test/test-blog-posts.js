'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the should syntax available throughout
// this module
const should = chai.should();

const { BlogPost, UserModel } = require('../models');
const { closeServer, runServer, app } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);

// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure  ata from one test does not stick
// around for next one
function tearDownDb() {
    return new Promise((resolve, reject) => {
        console.warn('Deleting database');
        mongoose.connection.dropDatabase()
            .then(result => resolve(result))
            .catch(err => reject(err));
    });
}


// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogPostData() {
    console.info('seeding blog post data');
    const seedData = [];
    for (let i = 1; i <= 10; i++) {
        seedData.push({
            author: {
                firstName: faker.name.firstName(),
                lastName: faker.name.lastName()
            },
            title: faker.lorem.sentence(),
            content: faker.lorem.text()
        });
    }

    // this will return a promise
    return BlogPost.insertMany(seedData).then(()=>{
        return seedUserData();
    });

}

function seedUserData(){
    console.info('seeding user data');
    UserModel.hashPassword('baseball')
        .then(pw => {
            return UserModel.create({username: 'bt', password: pw, firstName: 'Bobby!', lastname: 'Tables'});
        });
}

describe('blog posts API resource', function () {

    before(function () {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function () {
        return seedBlogPostData();
    });

    afterEach(function () {
        return tearDownDb();
    });

    after(function () {
        return closeServer();
    });

    describe('POST api/users endpoint', function(){
        it('should create a new user for authentication', function(){
            const newUser = {username: 'eve', password: 'football', firstName: 'Bobby', lastname: 'Tables'};
            return chai.request(app)
                .post('/api/users')
                .send(newUser)
                .then(res =>{
                    res.should.have.status(201);
                    res.should.be.json;
                    res.body.should.include.keys('username', 'firstName', 'lastName');
                    res.body.username.should.equal(newUser.username);
                })
                .catch(err =>{
                    console.error(err);
                });
        });

    });

    describe('POST api/protected endpoint', function(){
        it('should authenticate and show user', function(){
            const newUser = {username: 'bt', password: 'baseball'};
            return chai.request(app)
                .post('/api/protected')
                .send(newUser)
                .then(res =>{
                    res.should.have.status(200);
                    res.should.be.json;
                    res.body.should.include.keys('username', 'firstName', 'lastName');
                    res.body.username.should.equal(newUser.username);
                });
        });


    });

    describe('GET endpoint', function () {

        it('should return all existing posts', function () {
            // strategy:
            //    1. get back all posts returned by by GET request to `/posts`
            //    2. prove res has right status, data type
            //    3. prove the number of posts we got back is equal to number
            //       in db.
            let res;
            return chai.request(app)
                .get('/posts')
                .then(_res => {
                    res = _res;
                    res.should.have.status(200);
                    // otherwise our db seeding didn't work
                    res.body.should.have.length.of.at.least(1);

                    return BlogPost.count();
                })
                .then(count => {
                    // the number of returned posts should be same
                    // as number of posts in DB
                    res.body.should.have.length.of(count);
                });
        });

        it('should return posts with right fields', function () {
            // Strategy: Get back all posts, and ensure they have expected keys

            let resPost;
            return chai.request(app)
                .get('/posts')
                .then(function (res) {
                    res.should.have.status(200);
                    res.should.be.json;
                    res.body.should.be.a('array');
                    res.body.should.have.length.of.at.least(1);

                    res.body.forEach(function (post) {
                        post.should.be.a('object');
                        post.should.include.keys('id', 'title', 'content', 'author', 'created');
                    });
                    // just check one of the posts that its values match with those in db
                    // and we'll assume it's true for rest
                    resPost = res.body[0];
                    return BlogPost.findById(resPost.id);
                })
                .then(post => {
                    resPost.title.should.equal(post.title);
                    resPost.content.should.equal(post.content);
                    resPost.author.should.equal(post.authorName);
                });
        });
    });

    describe('POST endpoint', function () {

        it('should add a new blog post when authenticated', function () {
            const newPost = {
                username: 'bt',
                password: 'baseball',
                title: faker.lorem.sentence(),
                author: {
                    firstName: faker.name.firstName(),
                    lastName: faker.name.lastName(),
                },
                content: faker.lorem.text()
            };

            return chai.request(app)
                .post('/posts')
                // .auth('username', 'password')
                .send(newPost)
                .then(function (res) {
                    res.should.have.status(201);
                    res.should.be.json;
                    res.body.should.be.a('object');
                    res.body.should.include.keys(
                        'id', 'title', 'content', 'author', 'created');
                    res.body.title.should.equal(newPost.title);
                    // cause Mongo should have created id on insertion
                    res.body.id.should.not.be.null;
                    res.body.author.should.equal(
                        `${newPost.author.firstName} ${newPost.author.lastName}`);
                    res.body.content.should.equal(newPost.content);
                    return BlogPost.findById(res.body.id);
                })
                .then(function (post) {
                    post.title.should.equal(newPost.title);
                    post.content.should.equal(newPost.content);
                    post.author.firstName.should.equal(newPost.author.firstName);
                    post.author.lastName.should.equal(newPost.author.lastName);
                });
        });
    });

    describe('PUT endpoint', function () {

        it('should update fields you send over when authenticated', function () {
            const updateData = {
                username: 'bt',
                password: 'baseball',
                title: 'cats cats cats',
                content: 'dogs dogs dogs',
                author: {
                    firstName: 'foo',
                    lastName: 'bar'
                }
            };

            return BlogPost
                .findOne()
                .then(post => {
                    updateData.id = post.id;

                    return chai.request(app)
                        .put(`/posts/${post.id}`)
                        .send(updateData);
                })
                .then(res => {
                    res.should.have.status(204);
                    return BlogPost.findById(updateData.id);
                })
                .then(post => {
                    post.title.should.equal(updateData.title);
                    post.content.should.equal(updateData.content);
                    post.author.firstName.should.equal(updateData.author.firstName);
                    post.author.lastName.should.equal(updateData.author.lastName);
                });
        });
    });

    describe('DELETE endpoint', function () {

        it('should delete a post by id when authenticated', function () {

            let post;

            return BlogPost
                .findOne()
                .then(_post => {
                    post = _post;
                    return chai.request(app)
                        .delete(`/posts/${post.id}`)
                        .send({ username: 'bt', password: 'baseball'});
                })
                .then(res => {
                    console.log('1----------------');
                    console.log(JSON.stringify(res, null, 4));
                    console.log('2----------------');

                    res.should.have.status(204);
                    return BlogPost.findById(post.id);
                })
                .then(_post => {
                    // when a variable's value is null, chaining `should`
                    // doesn't work. so `_post.should.be.null` would raise
                    // an error. `should.be.null(_post)` is how we can
                    // make assertions about a null value.
                    should.not.exist(_post);
                })
                .catch( res => {
                    console.log('1----------------');
                    console.log(JSON.stringify(res.response.text, null, 4));
                    console.log('2----------------');
                    // i want it to fail; so i put 200 instead of 500
                    res.should.have.status(200);
                });
        });
    });

});
