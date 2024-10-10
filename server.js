var express = require('express');
var mssql = require('mssql');
var bodyParser = require('body-parser');
var path = require('path');
var session = require('express-session');
const multer = require('multer');
const upload = multer({ dest: 'imgs/' });



var app = express();
var admin = express();
var user = express();
var port = 8080;
app.use(session({
    secret: '88888888',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use('/admin', admin);
app.use('/user',user);

var config = {
    user: 'new_user',
    password: 'secure_password',
    server: 'localhost',
    database: 'testdb',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};
app.use(bodyParser.urlencoded({ extended: true }));
admin.use(bodyParser.urlencoded({ extended: true }));
admin.use(bodyParser.json());
user.use(bodyParser.urlencoded({ extended: true }));
app.use('/static', express.static('imgs'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Убедитесь, что у вас есть папка views



app.use(express.static(path.join(__dirname)));

var connection = new mssql.ConnectionPool(config);


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/reg', (req, res) => {
    res.sendFile(path.join(__dirname, 'reg.html'));
});

app.get('/log', (req, res) => {
    res.sendFile(path.join(__dirname, 'log.html'));
});

admin.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

user.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'user.html'));
});

app.post('/add-user', async (req, res) => {
    const { login, name, password } = req.body;

    try {
        await connection.connect();

        const result = await connection.request()
            .input('login', mssql.VarChar, login)
            .query('SELECT COUNT(*) as count FROM Users WHERE Login = @login');

        if (result.recordset[0].count > 0) {
            return res.status(400).send('Логин уже существует');
        }

        await connection.request()
            .input('login', mssql.VarChar, login)
            .input('name', mssql.VarChar, name)
            .input('password', mssql.VarChar, password)
            .query('INSERT INTO Users (Login, Name, Password) VALUES (@login, @name, @password)');

        res.status(201).send('Пользователь зарегистрирован успешно');
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        res.status(500).send('Ошибка при регистрации');
    } finally {
        await connection.close();
    }
});

app.post('/log-user', async (req, res) => {
    const { login, password } = req.body;

    console.log('Попытка входа:', { login, password });

    try {
        await connection.connect();

        const resultLoginUser = await connection.request()
            .input('login', mssql.NVarChar, login)
            .input('password', mssql.NVarChar, password)
            .query('SELECT COUNT(*) as count FROM Users WHERE Login = @login AND Password = @password');

        const resultLoginAdmin = await connection.request()
            .input('login', mssql.NVarChar, login)
            .input('password', mssql.NVarChar, password)
            .query('SELECT COUNT(*) as count FROM Admins WHERE Login = @login AND Password = @password');

        console.log('Результаты авторизации:', {
            userCount: resultLoginUser.recordset[0].count,
            adminCount: resultLoginAdmin.recordset[0].count
        });

        if (resultLoginUser.recordset[0].count === 0 && resultLoginAdmin.recordset[0].count === 0) {
            return res.status(400).send('Такого пользователя нет или пароль неверный');
        }

        if (resultLoginAdmin.recordset[0].count > 0) {
            req.session.isAdmin = true;
            return res.redirect('/pizzas');
        }

        if (resultLoginUser.recordset[0].count > 0) {
            req.session.isAdmin = false;
            console.log("Login:", login);
            req.session.userLogin = login;
            return res.redirect('/pizzas');
        }

    } catch (error) {
        console.error('Ошибка при авторизации:', error);
        res.status(500).send('Ошибка при авторизации');
    } finally {
        await connection.close();
    }
});
admin.get('/pizza-panel', (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).send('Доступ запрещен. Вы не администратор.');
    }
    res.sendFile(path.join(__dirname, 'admin-pizza.html')); // Отправляем форму для добавления пиццы
});

// Маршрут для добавления новой пиццы
admin.post('/add-pizza', upload.single('image'), async (req, res) => {
    const { name, price, quantity } = req.body;

    // Убедитесь, что req.file не undefined
    if (!req.file) {
        return res.status(400).send('Изображение не загружено');
    }

    const imageUrl = `/static/${req.file.filename}`; // Получаем имя файла

    try {
        await connection.connect();

        await connection.request()
            .input('name', mssql.VarChar, name)
            .input('imageUrl', mssql.VarChar, imageUrl)
            .input('price', mssql.Decimal, price)
            .input('quantity', mssql.Int, quantity)
            .query('INSERT INTO Pizzas (Name, ImageUrl, Price, Quantity) VALUES (@name, @imageUrl, @price, @quantity)');
        return res.redirect('/pizzas');
    } catch (error) {
        console.error('Ошибка при добавлении пиццы:', error);
        res.status(500).send('Ошибка при добавлении пиццы');
    } finally {
        await connection.close();
    }
});


admin.post('/add-admin', async (req, res) => {
    console.log('Полученные данные:', req.body);
    const {login, password } = req.body;

    try {
        await connection.connect();

        const result = await connection.request()
            .input('login', mssql.VarChar, login)
            .query('SELECT COUNT(*) as count FROM Admins WHERE Login = @login');

        if (result.recordset[0].count > 0) {
            return res.status(400).send('Логин уже существует');
        }

        await connection.request()
            .input('login', mssql.VarChar, login)
            .input('password', mssql.VarChar, password)
            .query('INSERT INTO Admins(Login,  Password) VALUES (@login, @password)');

        return res.send("Вы успешно добавили админа");
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        res.status(500).send('Ошибка при регистрации');
    } finally {
        await connection.close();
    }
});
app.get('/pizzas', async (req, res) => {
    try {
        await connection.connect();

        // Получение всех пицц из таблицы Pizzas
        const result = await connection.request().query('SELECT * FROM Pizzas');
        const pizzas = result.recordset;

        // Передаем список пицц и статус админа в шаблон
        res.render('pizzas', {
            pizzas,
            isAdmin: req.session.isAdmin // Передаем флаг админа
        });
    } catch (error) {
        console.error('Ошибка при получении пицц:', error);
        res.status(500).send('Ошибка при получении пицц');
    } finally {
        await connection.close();
    }
});

admin.delete('/delete-pizza/:id', async (req, res) => {
    const pizzaId = req.params.id;

    try {
        await connection.connect();

        // Удаление пиццы из базы данных по id
        await connection.request()
            .input('id', mssql.Int, pizzaId)
            .query('DELETE FROM Pizzas WHERE Id = @id');

        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка при удалении пиццы:', error);
        res.json({ success: false });
    } finally {
        await connection.close();
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});
