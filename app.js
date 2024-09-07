const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const { resolve } = require("path");
// Replace if using a different env file or config
const env = require("dotenv").config({ path: "./.env" });
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-08-01",
});

const cors = require("cors");
app.use(cors());
app.use(express.static(process.env.STATIC_DIR));
app.use(express.json());
const admin = require("firebase-admin");
const serviceAccount = require("./wuquf-4ea0b-firebase-adminsdk-3c5af-ae176e1e0f.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

app.get("/config", (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// =============== SING UP ================== //

app.post("/singup", async (req, res) => {
  try {
    const {
      email,
      password,
      phoneNumber,
      City,
      nationality,
      jins,
      fullname,
      photoURL,
    } = req.body;

    // إنشاء مستخدم جديد باستخدام Firebase Authentication
    const userResponse = await admin.auth().createUser({
      email: email,
      password: password,
      photoURL: photoURL,
      emailVerified: false,
    });

    const userJson = {
      id: userResponse.uid,
      fullname: fullname,
      email: email,
      phoneNumber: phoneNumber,
      City: City,
      nationality: nationality,
      jins: jins,
      photoURL: photoURL,
      reservations: [],
      role: ["Customer"],
    };

    // إضافة بيانات المستخدم إلى قاعدة البيانات
    const userDatabase = await db
      .collection("users")
      .doc(userResponse.uid)
      .set(userJson);

    res.json({ data: userJson, message: "تم إنشاء حساب بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error });
  }
});

// ============= GET USERS =========== //
app.get("/users", async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "لا توجد مستخدمين متاحين" });
    }

    // استخدام map بدلاً من forEach لتحسين الأداء
    const responseArr = snapshot.docs.map((doc) => doc.data());

    res.json({ data: responseArr });
  } catch (error) {
    res.status(500).json({ error: "حدثت مشكلة أثناء جلب البيانات" });
  }
});

// ============ find one user =========== //
app.get("/user/:id", async (req, res) => {
  try {
    const user = await db.collection("users").doc(req.params.id).get();
    if (!user.exists) {
      return res.status(400).json({ error: "المستخدم غير موجود" });
    }
    const response = user.data();
    res.json(response);
  } catch (err) {
    console.log(err);
  }
});

// ============= payment ============== //
app.post("/create-payment-intent", async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      currency: "EUR",
      amount: 1999,
      automatic_payment_methods: { enabled: true },
    });

    // Send publishable key and PaymentIntent details to client
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (e) {
    return res.status(400).send({
      error: {
        message: e.message,
      },
    });
  }
});

// ============ create Company =========== //
app.post("/create-company", async (req, res) => {
  try {
    const id = Math.random().toString(16).slice(2); // يجب التأكد من فريدية الهوية

    const {
      nameCompany,
      countParking,
      Subscription,
      CompanyParking,
      emailCompany,
    } = req.body;

    // التحقق من صحة البيانات المُمررة
    if (
      !nameCompany ||
      !countParking ||
      !Subscription ||
      !CompanyParking ||
      !emailCompany
    ) {
      return res
        .status(400)
        .json({ error: "يرجى توفير جميع البيانات المطلوبة" });
    }

    const CompanyJson = {
      id,
      nameCompany,
      emailCompany,
      countParking,
      Subscription,
      CompanyParking,
    };

    await db.collection("company").doc(id).set(CompanyJson); // تأكد من أن اسم المجموعة صحيح

    res.json({ data: CompanyJson, message: "تمت إضافة شركة بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء إضافة الشركة" });
  }
});
// =========== get company =========== //
app.get("/get-company", async (req, res) => {
  try {
    const CompanyRef = db.collection("company");
    const snapshot = await CompanyRef.get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "لا توجد شركات متاحة" });
    }

    let responseArr = [];
    snapshot.forEach((doc) => {
      responseArr.push(doc.data());
    });

    res.json(responseArr);
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء جلب البيانات" });
  }
});
// ============ get one company ============= //
app.get("/getOne-company/:id", async (req, res) => {
  try {
    const CompanyRef = db.collection("company").doc(req.params.id);

    // التحقق من وجود السجل قبل استرداد البيانات
    const doc = await CompanyRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "الشركة غير موجودة" });
    }

    const response = doc.data();
    res.json(response);
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء الاستعلام عن البيانات" });
  }
});
// =========== update company =============== //
app.post("/update-company/:id", async (req, res) => {
  try {
    const {
      nameCompany,
      countParking,
      Subscription,
      CompanyParkingLocations,
      emailCompany,
    } = req.body;

    // التأكد من وجود البيانات المطلوبة
    if (
      !nameCompany ||
      !countParking ||
      !Subscription ||
      !CompanyParkingLocations ||
      !emailCompany
    ) {
      return res
        .status(400)
        .json({ error: "يرجى توفير جميع البيانات المطلوبة" });
    }

    const CompanyRef = db.collection("company").doc(req.params.id);
    const CompanyJson = {
      nameCompany,
      emailCompany,
      countParking,
      Subscription,
      CompanyParkingLocations,
    };

    const response = await CompanyRef.update(CompanyJson);

    res.json({ message: "تم التحديث بنجاح", response });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء التحديث" });
  }
});
// ================ delete company =============== //
app.delete("/delete-company/:id", async (req, res) => {
  try {
    const CompanyRef = db.collection("company").doc(req.params.id);

    // التحقق من وجود السجل قبل الحذف
    const companySnapshot = await CompanyRef.get();
    if (!companySnapshot.exists) {
      return res.status(404).json({ error: "الشركة غير موجودة" });
    }

    await CompanyRef.delete();
    res.json({ message: "تم الحذف بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء الحذف" });
  }
});

// ============ subscripe =========== //
app.post("/subscripe-company/:id", async (req, res) => {
  try {
    const {
      nameCompany,
      countParking,
      Subscription,
      CompanyParkingLocations,
      emailCompany,
      expiresIn,
    } = req.body;

    // التأكد من وجود البيانات المطلوبة
    if (
      !nameCompany ||
      !countParking ||
      !Subscription ||
      !CompanyParkingLocations ||
      !emailCompany ||
      !expiresIn
    ) {
      return res
        .status(400)
        .json({ error: "يرجى توفير جميع البيانات المطلوبة" });
    }

    const token = jwt.sign(
      {
        nameCompany,
        countParking,
        Subscription,
        CompanyParkingLocations,
        emailCompany,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: expiresIn }
    );

    const CompanyRef = db.collection("company").doc(req.params.id);
    await CompanyRef.update({ Subscription, token });

    res.json({ message: "تم الاشتراك بنجاح", token });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء الاشتراك" });
  }
});

// ========== CREATE Location PARK ========== //

app.post("/create-location-park/:companyId", async (req, res) => {
  try {
    const { ParkingLocations, description, images } = req.body;
    const companyId = req.params.companyId;
    const id = Math.random().toString(16).slice(2);
    const parkingJson = {
      id: id,
      ParkingLocations,
      description,
      images: images,
      Park: [],
    };

    await db.collection("parking-locations").doc(id).set(parkingJson);

    const companyRef = db.collection("company").doc(companyId);
    const companySnapshot = await companyRef.get();

    if (!companySnapshot.exists) {
      return res.status(404).json({ error: "الشركة غير موجودة" });
    }

    const companyData = companySnapshot.data();
    const updatedCompanyParking = [...(companyData.CompanyParking || []), id];

    await companyRef.update({ CompanyParking: updatedCompanyParking });

    res.json({ data: parkingJson, message: "تم إنشاء مواقف جديدة بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء عملي" });
  }
});

// ========== GET Location PARK =========== //

app.get("/get-parking", async (req, res) => {
  try {
    const parkingSnapshot = await db.collection("parking-locations").get();

    if (parkingSnapshot.empty) {
      return res.status(404).json({ error: "لا توجد بيانات للمواقف" });
    }

    const responseArr = parkingSnapshot.docs.map((doc) => doc.data());
    res.json(responseArr);
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء استرداد بيانات المواقف" });
  }
});

// ============= FIND ONE Location PARKING ============ //

app.get("/get-parking/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const parkingRef = db.collection("parking-locations").doc(id);
    const snapshot = await parkingRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: "الموقف غير موجود" });
    }
    
    const parkingData = snapshot.data();
    const parkRef = await db.collection("Parking");
    const ArrId = [];
    for (i = 0; i < parkingData.Park.length; i++) {
      ArrId.push((await parkRef.doc(parkingData.Park[i]).get()).data());
    }

    res.json({
      ParkingLocations: parkingData.ParkingLocations,
      images: parkingData.images,
      description: parkingData.description,
      id: parkingData.id,
      Park: ArrId,
    });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء استرداد بيانات الموقف" });
  }
});

// =========== DELETE Location PARKING ========= //
app.delete("/delete-parking/:id", async (req, res) => {
  try {
    const { ParkingLocations, Park } = req.body;
    const id = req.params.id;

    const parkingRef = db.collection("parking-locations").doc(id);
    const snapshot = await parkingRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: "الموقف غير موجود" });
    }

    parkingRef.delete();
    res.json({ message: "تم حذف بيانات الموقف بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء تحديث بيانات الموقف" });
  }
});

// ========== UPDATE Location PARKING ============ //
app.post("/update-parking/:id", async (req, res) => {
  try {
    const { ParkingLocations, images, description, Park } = req.body;
    const id = req.params.id;

    const parkingRef = db.collection("parking-locations").doc(id);
    const snapshot = await parkingRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: "الموقف غير موجود" });
    }

    await parkingRef.update({
      ParkingLocations,
      images,
      description,
      Park,
    });

    res.json({ message: "تم تحديث بيانات الموقف بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء تحديث بيانات الموقف" });
  }
});

// =========== CREATE PARKING ============ //

app.post("/create-parking/:ParkingId", async (req, res) => {
  try {
    const { word, reserve } = req.body;
    const parkingId = req.params.ParkingId;

    const parkingRef = db.collection("parking-locations").doc(parkingId);
    const parkingSnapshot = await parkingRef.get();

    if (!parkingSnapshot.exists) {
      return res.status(404).json({ error: "الموقف غير موجود" });
    }

    const id = Math.random().toString(16).slice(2);
    const ParkJson = {
      id,
      word,
      reserve: "",
    };

    const parkDocRef = db.collection("Parking").doc(id);
    await parkDocRef.set(ParkJson);
    console.log(parkingSnapshot.data().Park);
    const ArrId = [...parkingSnapshot.data().Park, id];

    await parkingRef.update({
      Park: ArrId,
    });

    res.json({ data: ParkJson, message: "تم إنشاء موقف بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء إنشاء الموقف" });
  }
});

// ============ GET PARK ============ //
app.get("/get-park", async (req, res) => {
  try {
    const snapshot = await db.collection("Parking").get();
    const responseArr = snapshot.docs.map((doc) => doc.data());

    res.json({ data: responseArr, message: "تم جلب المعلومات بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء جلب المعلومات" });
  }
});

app.get("/get-park/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const parkRef = await db.collection("Parking").doc(id);
    const snapshot = await parkRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: "الموقف غير موجود" });
    }

    res.json(snapshot.data());
  } catch (err) {
    console.error("حدث خطأ:", err);
    res.status(500).json({ error: "حدثت مشكلة أثناء جلب المعلومات" });
  }
});

// ============ DELETE PARK ========== //
app.delete("/delete-park/:ParkId", async (req, res) => {
  const parkId = req.params.ParkId;

  try {
    const parkRef = db.collection("Parking").doc(parkId);
    const doc = await parkRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "المستند غير موجود" });
    }

    await parkRef.delete();
    res.json({ message: "تم حذف البيانات بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء عملية الحذف" });
  }
});

// ============ UPDATE PARK =========== //

app.post("/update-park/:ParkId", async (req, res) => {
  const { word } = req.body;
  const parkId = req.params.ParkId;

  try {
    const parkRef = db.collection("Parking").doc(parkId);

    await parkRef.set(
      {
        word,
      },
      { merge: true }
    );

    res.json({ message: "تم تحديث الكلمة بنجاح", word });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء تحديث الكلمة" });
  }
});

// ============ GET RESERVE ============ //
app.get("/reserve-parking", async (req, res) => {
  try {
    const snapshot = await db.collection("reserve").get();
    const responseArr = [];

    snapshot.forEach((doc) => {
      responseArr.push(doc.data());
    });

    res.json(responseArr);
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء جلب البيانات" });
  }
});

// =========== Reserve Parking ============ //
app.post("/reserve-parking/:parkId", async (req, res) => {
  try {
    const { userId } = req.body;
    const parkId = req.params.parkId;

    if (!userId) {
      return res.status(400).json({ error: "يجب تقديم معرف المستخدم" });
    }

    const reserveRef = db.collection("reserve").doc(parkId);
    await reserveRef.set({ userId, parkId });

    const parkingRef = db.collection("Parking").doc(parkId);
    await parkingRef.update({ reserve: userId });

    res.json({ message: "تم الحجز بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء عملية الحجز" });
  }
});

// ============= Reserve Delete =========== //

app.delete("/delete-Reserve/:parkId", async (req, res) => {
  try {
    const parkId = req.params.parkId;

    const reserveRef = db.collection("reserve").doc(parkId);
    const reserveDoc = await reserveRef.get();

    if (!reserveDoc.exists) {
      return res.status(404).json({ error: "الحجز غير موجود" });
    }

    await reserveRef.delete();

    const parkingRef = db.collection("Parking").doc(parkId);
    await parkingRef.update({ reserve: "" });

    res.json({ message: "تم إلغاء الحجز بنجاح" });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء إلغاء الحجز" });
  }
});

// ============ Reserve UPDATE ============= //

app.post("/update-reserve/:reserveId", async (req, res) => {
  const { userId, parkId } = req.body;
  const reserveId = req.params.reserveId;

  try {
    const reserveRef = db.collection("reserve").doc(reserveId);

    await reserveRef.update({
      userId,
      parkId,
    });

    res.json({ message: "تم تحديث الحجز بنجاح", userId, parkId });
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ error: "حدثت مشكلة أثناء تحديث الحجز" });
  }
});

// ========= LISTEN ========== //
app.listen(3000, () => console.log(`http://localhost:3000`));
