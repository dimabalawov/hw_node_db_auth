var express = require('express');
var mssql = require('mssql');
var bodyParser = require('body-parser');
var path = require('path');
var session = require('express-session');



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
            return res.redirect('/admin');
        }

        if (resultLoginUser.recordset[0].count > 0) {
            console.log("Login:", login);
            req.session.userLogin = login;
            return res.redirect('/user');
        }

    } catch (error) {
        console.error('Ошибка при авторизации:', error);
        res.status(500).send('Ошибка при авторизации');
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
admin.post('/all-users', async (req, res) => {
    try {
        await connection.connect();

        const users = await connection.request().query('SELECT * FROM Users');
        return res.json(users.recordset); // Возвращаем пользователей

    } catch (error) {
        console.error('Ошибка при отображении пользователей:', error);
        res.status(500).send('Ошибка при отображении пользователей');
    } finally {
        await connection.close();
    }
});
user.post('/delete-user', async (req, res) => {
    const login = req.session.userLogin;

    if (!login) {
        return res.status(403).send('Необходимо войти в систему, чтобы удалить пользователя.');
    }

    try {
        await connection.connect();

        // Запрос для удаления пользователя по логину
        await connection.request()
            .input('login', mssql.VarChar, login)
            .query('DELETE FROM Users WHERE Login = @login');

        return res.send('Пользователь успешно удален');

    } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        res.status(500).send('Ошибка при удалении пользователя');
    } finally {
        await connection.close();
    }
});
// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});
