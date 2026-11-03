package store

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
	"jianwei/backend/internal/domain"
)

var ErrConflict = errors.New("workspace revision conflict")

type Repository interface {
	Get(context.Context) (domain.Workspace, error)
	Save(context.Context, domain.Workspace, int64) (domain.Workspace, error)
	Ping(context.Context) error
}

type Mongo struct {
	client     *mongo.Client
	collection *mongo.Collection
}
type document struct {
	ID        string           `bson:"_id"`
	Workspace domain.Workspace `bson:",inline"`
	UpdatedAt time.Time        `bson:"updatedAt"`
}

func Open(ctx context.Context, uri, dbName string) (*Mongo, error) {
	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(5 * time.Second))
	if err != nil {
		return nil, err
	}
	store := &Mongo{client: client, collection: client.Database(dbName).Collection("workspaces")}
	if err = store.Ping(ctx); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, err
	}
	initial := document{ID: "default", Workspace: domain.Empty(), UpdatedAt: time.Now().UTC()}
	_, err = store.collection.UpdateOne(ctx, bson.M{"_id": "default"}, bson.M{"$setOnInsert": initial}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		_ = client.Disconnect(context.Background())
		return nil, err
	}
	return store, nil
}

func (s *Mongo) Ping(ctx context.Context) error  { return s.client.Ping(ctx, readpref.Primary()) }
func (s *Mongo) Close(ctx context.Context) error { return s.client.Disconnect(ctx) }
func (s *Mongo) Get(ctx context.Context) (domain.Workspace, error) {
	var doc document
	err := s.collection.FindOne(ctx, bson.M{"_id": "default"}).Decode(&doc)
	return doc.Workspace, err
}

func (s *Mongo) Save(ctx context.Context, next domain.Workspace, expected int64) (domain.Workspace, error) {
	next.Revision = expected + 1
	doc := document{ID: "default", Workspace: next, UpdatedAt: time.Now().UTC()}
	result, err := s.collection.ReplaceOne(ctx, bson.M{"_id": "default", "revision": expected}, doc)
	if err != nil {
		return domain.Workspace{}, err
	}
	if result.MatchedCount == 0 {
		return domain.Workspace{}, ErrConflict
	}
	return next, nil
}
