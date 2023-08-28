const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gkz5fmx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const audioCollection = client.db("audioVibe").collection("allMusic")
        const favoritesCollection = client.db("audioVibe").collection("favorites")
        const playlistsCollection = client.db("audioVibe").collection("playlists")

        // creating index for searching
        // const indexKeys = { title: 1 }
        // const indexOptions = { name: "titleSearch" }

        // const result = await audioCollection.createIndex(indexKeys, indexOptions)

        app.get('/getMusicByTitle/:text', async (req, res) => {
            const searchText = req.params.text

            const result = await audioCollection.find({
                title: { $regex: searchText, $options: "i" }
            }).toArray()
            res.send(result)
        })

        app.get('/allMusicFeatured', async (req, res) => {
            const query = { status: "featured" }

            const result = await audioCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/allMusicOnSearchDefault', async (req, res) => {
            const result = await audioCollection.find().limit(9).toArray()
            res.send(result)
        })

        app.get('/allMusic', async (req, res) => {
            const result = await audioCollection.find().toArray()
            res.send(result)
        })

        app.get('/singleMusicDetails/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await audioCollection.findOne(query)
            res.send(result)
        })

        app.get('/getPlaylistByUser/:email', async (req, res) => {
            const email = req.params.email
            const query = { userEmail: email }
            const result = await playlistsCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/favoriteMusicByUser/:email', async (req, res) => {
            const email = req.params.email
            const query = { userEmail: email }
            const result = await favoritesCollection.find(query).toArray()
            res.send(result)
        })

        // adding music to favorite related apis
        app.post('/favoriteMusic', async (req, res) => {
            const favoriteMusic = req.body
            const exists = await favoritesCollection.findOne(favoriteMusic)
            if (exists) {
                return res.send({ message: 'You already added this song once' })
            }
            const result = await favoritesCollection.insertOne(favoriteMusic)
            res.send(result)
        })

        // updating favorites count
        app.put('/addingFavoriteCount/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const music = req.body
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    likes: parseInt(music.likes) + 1
                }
            }

            const result = await audioCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })

        app.put('/deductingFavoriteCount/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const music = req.body
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    likes: parseInt(music.likes) - 1
                }
            }
            const result = await audioCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        // getting single favorite music
        app.get('/singleFavoriteMusic/:id/:email', async (req, res) => {
            const id = req.params.id
            const email = req.params.email
            const query = { musicId: id, userEmail: email }
            const result = await favoritesCollection.findOne(query)
            res.send(result)
        })

        // creating playlists related apis
        app.post('/createAPlaylist', async (req, res) => {
            const playlist = req.body
            const result = await playlistsCollection.insertOne(playlist)
            res.send(result)
        })

        // deleting from playlist
        app.delete('/deletePlaylist/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await playlistsCollection.deleteOne(query)
            res.send(result)
        })

        // adding music to playlists related apis
        app.post('/addToPlaylist', async (req, res) => {
            const { id, music } = req.body

            const playlist = await playlistsCollection.findOne({ _id: new ObjectId(id) })
            if (!playlist) {
                return res.status(404).send({ error: true, message: "Playlist not found" });
            }

            const exists = await playlist.songs.find(song => song._id === music._id)

            if (exists) {
                return res.status(400).send({ error: true, message: "This music is already added to this playlist" });
            }

            const result = await playlistsCollection.updateOne({ _id: new ObjectId(id) }, { $push: { songs: music } })
            res.send(result)
        })

        // deleting music from selected playlist
        app.post('/deleteFromPlaylist', async (req, res) => {
            const { id, musicId } = req.body

            const playlist = await playlistsCollection.findOne({ _id: new ObjectId(id) })
            if (!playlist) {
                return res.status(404).send({ error: true, message: "Playlist not found" })
            }

            const existingSongIndex = await playlist.songs.findIndex(song => song._id === musicId)
            if (existingSongIndex === -1) {
                return res.status(404).send({ error: true, message: "Music not found" })
            }

            playlist.songs.splice(existingSongIndex, 1)

            const result = await playlistsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { songs: playlist.songs } }
            );

            res.send(result)
        })

        // deleting from favorites 
        app.delete('/deleteFromFavorites/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await favoritesCollection.deleteOne(query)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Audio Vibe server is running')
})

app.listen(port, () => {
    console.log(`server is running on port: ${port}`)
})