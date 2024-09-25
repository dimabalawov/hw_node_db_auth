var express = require('express');
var mssql = require('mssql');
var bodyParser = require('body-parser');
var path = require('path');

var app = express();
var port = 8080;

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

        if (resultLoginUser.recordset[0].count === 0 && resultLoginAdmin.recordset[0].count === 0) {
            return res.status(400).send('Такого пользователя нет или пароль неверный');
        }

        if (resultLoginAdmin.recordset[0].count > 0) {
            const users = await connection.request().query('SELECT * FROM Users');
            return res.json(users.recordset); // Возвращаем пользователей
        }
        
        if (resultLoginUser.recordset[0].count > 0) {
            return res.send("Вы успешно вошли как пользователь");
        }

    } catch (error) {
        console.error('Ошибка при авторизации:', error);
        res.status(500).send('Ошибка при авторизации');
    } finally {
        await connection.close();
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});
