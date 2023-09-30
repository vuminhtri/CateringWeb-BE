const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const Stripe = require("stripe")

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 8080;

// MongoDB Connection
mongoose.set("strictQuery", false);
mongoose
    .connect(process.env.MONGODB_URL)
    .then(() => console.log("Connected to Database"))
    .catch((err) => console.log(err));

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_KEY_SECRET,
});

// Schema
const userSchema = mongoose.Schema({
    firstName: String,
    lastName: String,
    email: {
        type: String,
        unique: true,
    },
    password: String,
    confirmPassword: String,
    image: String,
});

const productSchema = mongoose.Schema({
    name: String,
    category: String,
    // image: {
    //     public_id: String,
    //     url: String,
    // },
    image: String,
    price: String,
    description: String,
});

const imageSchema = mongoose.Schema({
    image: String,
});

const userModel = mongoose.model("user", userSchema);
const productModel = mongoose.model("product", productSchema);
const imageModel = mongoose.model("image", imageSchema);

// API
app.get("/", (req, res) => {
    res.send("Server is running...");
});

app.post("/signup", async (req, res) => {
    const { email } = req.body;

    try {
        const existingUser = await userModel.findOne({ email: email });
        if (existingUser) {
            res.status(400).json({
                message: "Email is already registered",
                alert: false,
            });
            return;
        }
        const newUser = userModel(req.body);
        const save = newUser.save();
        res.status(201).json({
            message: "Successfully signed up",
            alert: true,
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", alert: false });
    }
});

app.post("/login", async (req, res) => {
    // console.log(req.body);
    const { email, password } = req.body;
    try {
        const user = await userModel.findOne({ email: email });
        if (!user) {
            res.status(401).json({ message: "User not found", alert: false });
            return;
        }

        if (user.password === password) {
            const dataSend = {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                image: user.image,
            };
            res.status(200).json({
                message: "Login successful",
                alert: true,
                data: dataSend,
            });
        } else {
            res.status(401).json({
                message: "Incorrect password",
                alert: false,
            });
        }
    } catch (error) {
        res.status(500).json({ message: "Server error", alert: false });
    }
});

app.post("/uploadProduct", async (req, res) => {
    const { name, image, category, price, description } = req.body;
    try {
        const result = await cloudinary.uploader.upload(image, {
            folder: "productImage",
        });
        const product = await productModel.create({
            name,
            category,
            // image: {
            //     public_id: result.public_id,
            //     url: result.secure_url,
            // },
            image: result.secure_url,
            price,
            description,
        });
        res.status(201).json({
            success: true,
            message: "Upload successfully",
            product
        });
    } catch (error) {
        console.error(error);
    }
});

app.get("/products", async (req, res) => {
    const data = await productModel.find({});
    res.send(JSON.stringify(data));
});

app.get("/productNameList", async (req, res) => {
    const data = await productModel.find({}, "category");
    res.send(JSON.stringify(data));
});

app.post("/upload-image", async (req, res) => {
    const { imagebase64 } = req.body;
    try {
        const result = await cloudinary.uploader.upload(imagebase64, {
            folder: productImage,
        });
        imageModel.create({ image: imagebase64 });
        res.send({ Status: "ok" });
    } catch (error) {
        res.send({ Status: "error", data: error });
    }
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
app.post("/checkout-payment", async(req, res) => {
    try {
        const params = {
            submit_type: "pay",
            mode: "payment",
            payment_method_types: ['card'],
            billing_address_collection: "auto",
            shipping_options: [{shipping_rate : "shr_1NvgMsH19cOYiAl7fqAR9RT8"}],
            line_items: req.body.map((item) => {
                return {
                    price_data : {
                        currency: "vnd",
                        product_data : {
                            name : item.name,
                        },
                        unit_amount: item.price,
                    },
                    adjustable_quantity: {
                        enabled: true,
                        minimum: 1,
                    },
                    quantity: item.qty
                }
            }),

            success_url: `${process.env.FRONTEND_URL}/success`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel`,
        }
        const session = await stripe.checkout.sessions.create(params)
        res.status(200).json(session.id)
    }catch (err) {
        res.status(err.statusCode || 500).json(err.message)
    }
})



app.listen(PORT, () => console.log("Server is running at port: " + PORT));
